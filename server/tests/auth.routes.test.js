const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

const createUserDoc = (overrides = {}) => {
  const doc = {
    _id: overrides._id || "user-1",
    name: overrides.name || "Test User",
    email: overrides.email || "user@example.com",
    password: overrides.password || "hashed-password",
    role: overrides.role || "user",
    storageLimit: overrides.storageLimit ?? 5242880000,
    storageUsed: overrides.storageUsed ?? 0,
    settings: overrides.settings || { theme: "light" },
    preferences: overrides.preferences || { viewMode: "list" },
    passwordHistory: overrides.passwordHistory || [],
    createdAt: overrides.createdAt || new Date("2026-01-01T00:00:00.000Z"),
    save: jest.fn().mockImplementation(async () => doc),
    select: jest.fn().mockImplementation(async () => doc),
    toObject: jest.fn().mockImplementation(() => ({
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      storageLimit: doc.storageLimit,
      storageUsed: doc.storageUsed,
      settings: doc.settings,
      preferences: doc.preferences,
      passwordHistory: doc.passwordHistory,
      createdAt: doc.createdAt,
    })),
  };
  return doc;
};

const mockUserModel = jest.fn((data) => createUserDoc(data));
mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();
mockUserModel.findByIdAndUpdate = jest.fn();
mockUserModel.findByIdAndDelete = jest.fn();

jest.mock("../models/User", () => mockUserModel);
jest.mock("../middleware/auth", () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = req.user || { id: "user-1", role: "user" };
    next();
  }),
}));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logError: jest.fn(),
  logAuth: jest.fn(),
  logPerformance: jest.fn(),
}));
jest.mock("../utils/emailService", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/refreshTokenHelpers", () => ({
  generateRefreshToken: jest.fn().mockResolvedValue("refresh-token"),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
  validateRefreshToken: jest.fn(),
}));
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn(),
}));
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("access-token"),
  verify: jest.fn(),
}));

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const emailService = require("../utils/emailService");
const refreshTokenHelpers = require("../utils/refreshTokenHelpers");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", require("../routes/auth"));
  return app;
};

describe("auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserModel.findOne.mockReset();
    mockUserModel.findById.mockReset();
    mockUserModel.findByIdAndUpdate.mockReset();
    mockUserModel.findByIdAndDelete.mockReset();
    jwt.verify.mockReset();
    bcrypt.compare.mockReset();
  });

  it("registers a new user and rejects invalid registrations", async () => {
    mockUserModel.findOne.mockResolvedValueOnce(null);

    const app = buildApp();

    await request(app)
      .post("/api/auth/register")
      .send({ email: "bad", password: "1" })
      .expect(400);

    const success = await request(app)
      .post("/api/auth/register")
      .send({ name: "New User", email: "new@example.com", password: "secret123" })
      .expect(201);

    expect(success.body.user.email).toBe("new@example.com");
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(refreshTokenHelpers.generateRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when a registration email already exists", async () => {
    mockUserModel.findOne.mockResolvedValueOnce(createUserDoc({ email: "existing@example.com" }));

    const app = buildApp();
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Existing", email: "existing@example.com", password: "secret123" });

    expect(response.status).toBe(409);
    expect(response.body.errorType).toBe("USER_EXISTS");
  });

  it("logs users in, rejects bad credentials, and refreshes tokens", async () => {
    const user = createUserDoc({ email: "login@example.com", password: "hashed-password" });
    mockUserModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user).mockResolvedValueOnce(user);
    bcrypt.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const app = buildApp();

    await request(app)
      .post("/api/auth/login")
      .send({ email: "bad", password: "x" })
      .expect(400);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@example.com", password: "secret123" })
      .expect(401);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrongpass" })
      .expect(401);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "secret123" })
      .expect(200);

    expect(response.body.user.email).toBe("login@example.com");
    expect(refreshTokenHelpers.generateRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("handles refresh token and logout flows", async () => {
    refreshTokenHelpers.validateRefreshToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "user-1" })
      .mockResolvedValueOnce({ id: "user-1" });
    mockUserModel.findById
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc()) });

    const app = buildApp();

    await request(app)
      .post("/api/auth/refresh-token")
      .expect(401);

    await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken: "invalid" })
      .expect(403);

    await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken: "valid" })
      .expect(401);

    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken: "valid" })
      .expect(200);

    expect(response.body.message).toBe("Token refreshed successfully");

    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: "refresh-to-revoke" })
      .expect(200);

    expect(refreshTokenHelpers.revokeRefreshToken).toHaveBeenCalledWith("refresh-to-revoke");
  });

  it("fetches profiles and handles password reset flows", async () => {
    mockUserModel.findById
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc()) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) })
      .mockResolvedValueOnce(createUserDoc({ email: "reset@example.com" }))
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) })
      .mockResolvedValueOnce(createUserDoc({ email: "reset@example.com" }));
    jwt.verify.mockImplementationOnce(() => { throw new Error("bad token"); });
    jwt.verify
      .mockReturnValueOnce({ id: "user-1", type: "password_reset" })
      .mockReturnValueOnce({ id: "user-1", type: "password_reset" });

    const app = buildApp();

    await request(app).get("/api/auth/me").expect(200);
    await request(app).get("/api/auth/me").expect(404);

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "bad" })
      .expect(400);

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "missing@example.com" })
      .expect(200);

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "reset@example.com" })
      .expect(200);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "bad", newPassword: "secret123" })
      .expect(400);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(null);
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "good", newPassword: "secret123" })
      .expect(404);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({ email: "reset@example.com" }));
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "good", newPassword: "secret123" })
      .expect(200);

    expect(response.body.message).toMatch(/Password reset successful/);
    expect(refreshTokenHelpers.revokeAllUserTokens).toHaveBeenCalled();
  });

  it("returns 500 when password reset fails after validation succeeds", async () => {
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({ email: "reset@example.com" }));
    bcrypt.hash.mockResolvedValueOnce("hashed-password");
    refreshTokenHelpers.revokeAllUserTokens.mockRejectedValueOnce(new Error("token revoke failed"));
    jwt.verify.mockReturnValueOnce({ id: "user-1", type: "password_reset" });

    const app = buildApp();
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "good", newPassword: "secret123" });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("token revoke failed");
  });

  it("rejects password reset tokens with the wrong type", async () => {
    jwt.verify.mockReturnValueOnce({ id: "user-1", type: "not-password-reset" });

    const app = buildApp();
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "good", newPassword: "secret123" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid or expired reset token");
  });

  it("returns 500 when forgot-password notification fails", async () => {
    const user = createUserDoc({ email: "reset@example.com" });
    mockUserModel.findOne.mockResolvedValueOnce(user);
    emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error("smtp failed"));

    const app = buildApp();
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "reset@example.com" });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to process password reset request");
  });
});