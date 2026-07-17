const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

const createUserDoc = (overrides = {}) => {
  const doc = {
    _id: overrides._id || "guest-user-1",
    name: overrides.name || "Guest User",
    email: overrides.email || "guest@example.com",
    password: overrides.password || "hashed-password",
    role: overrides.role || "guest",
    storageLimit: overrides.storageLimit ?? 500 * 1024 * 1024,
    storageUsed: overrides.storageUsed ?? 0,
    isTemporaryGuest: overrides.isTemporaryGuest ?? true,
    guestSessionId: overrides.guestSessionId || "session-1",
    save: jest.fn().mockImplementation(async () => doc),
  };
  return doc;
};

const mockUserModel = jest.fn((data) => createUserDoc(data));
mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();

const mockUserStatics = {
  findOne: jest.fn(),
  findById: jest.fn(),
};

const mockGuestSession = {
  findById: jest.fn(),
  createSession: jest.fn(),
  getSessionStatus: jest.fn(),
  extendSession: jest.fn(),
  convertSession: jest.fn(),
  GUEST_STORAGE_LIMIT: 500 * 1024 * 1024,
  GUEST_MAX_EXTENSIONS: 3,
};

jest.mock("../models/User", () => mockUserModel);
jest.mock("../models/GuestSession", () => mockGuestSession);
jest.mock("../utils/cleanupScheduler", () => ({
  cleanupSingleGuestSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/refreshTokenHelpers", () => ({
  generateRefreshToken: jest.fn().mockResolvedValue("refresh-token"),
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
jest.mock("../middleware/auth", () => ({
  authenticateToken: jest.fn((req, res, next) => {
    const raw = req.headers["x-test-user"];
    if (raw) {
      req.user = JSON.parse(raw);
    }
    next();
  }),
}));
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("guest-access-token"),
}));
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("guest-uuid-1234"),
}));

const bcrypt = require("bcryptjs");
const cleanupScheduler = require("../utils/cleanupScheduler");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth/guest", require("../routes/guest"));
  return app;
};

describe("guest routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserModel.findOne.mockReset();
    mockUserModel.findById.mockReset();
    mockGuestSession.findById.mockReset();
    mockGuestSession.createSession.mockReset();
    mockGuestSession.getSessionStatus.mockReset();
    mockGuestSession.extendSession.mockReset();
    mockGuestSession.convertSession.mockReset();
    bcrypt.hash.mockReset();
  });

  it("creates and resumes guest sessions", async () => {
    const guestSession = { _id: "session-1", expiresAt: new Date(Date.now() + 3600000), extensionCount: 0 };
    mockGuestSession.createSession.mockResolvedValue(guestSession);
    bcrypt.hash.mockResolvedValue("hashed-password");
    mockGuestSession.findById.mockResolvedValue({ _id: "old-session", userId: "guest-user-1" });
    mockUserModel.findOne.mockResolvedValueOnce(createUserDoc({ _id: "guest-user-1", guestSessionId: "session-1" }));

    const app = buildApp();

    const createResponse = await request(app)
      .post("/api/auth/guest")
      .send({ previousSessionId: "old-session" })
      .expect(201);

    expect(cleanupScheduler.cleanupSingleGuestSession).toHaveBeenCalled();
    expect(createResponse.body.user.role).toBe("guest");

    mockGuestSession.findById.mockResolvedValueOnce(null);
    await request(app).post("/api/auth/guest/resume").send({}).expect(400);
    await request(app).post("/api/auth/guest/resume").send({ sessionId: "missing" }).expect(404);
  });

  it("covers guest creation, resume, extend, and convert error branches", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    mockGuestSession.createSession.mockRejectedValueOnce(new Error("create failed"));

    const app = buildApp();

    await request(app)
      .post("/api/auth/guest")
      .send({ previousSessionId: "old-session" })
      .expect(500);

    mockGuestSession.createSession.mockResolvedValueOnce({
      _id: "session-1",
      expiresAt: new Date(Date.now() + 3600000),
      extensionCount: 0,
    });

    mockGuestSession.findById.mockResolvedValueOnce({
      _id: "expired-session",
      status: "expired",
      expiresAt: new Date(Date.now() - 1000),
    });
    await request(app).post("/api/auth/guest/resume").send({ sessionId: "expired-session" }).expect(410);

    mockGuestSession.findById.mockResolvedValueOnce({
      _id: "valid-session",
      status: "active",
      expiresAt: new Date(Date.now() + 1000),
    });
    mockUserModel.findOne.mockResolvedValueOnce(null);
    await request(app).post("/api/auth/guest/resume").send({ sessionId: "valid-session" }).expect(404);

    await request(app)
      .post("/api/auth/guest/extend")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: false }))
      .expect(400);

    await request(app)
      .post("/api/auth/guest/extend")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: true }))
      .expect(400);

    mockUserModel.findOne.mockResolvedValueOnce(null);
    mockUserModel.findById.mockResolvedValueOnce(null);
    await request(app)
      .post("/api/auth/guest/convert")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: true, email: "guest@example.com" }))
      .send({ name: "A", email: "new@example.com", password: "secret123" })
      .expect(404);

    mockGuestSession.extendSession.mockRejectedValueOnce(new Error("extend failed"));
    await request(app)
      .post("/api/auth/guest/extend")
      .set("x-test-user", JSON.stringify({ id: "guest-user-2", isTemporaryGuest: true, guestSessionId: "session-2" }))
      .expect(500);

    mockGuestSession.createSession.mockResolvedValueOnce({
      _id: "session-2",
      expiresAt: new Date(Date.now() + 3600000),
      extensionCount: 0,
    });
    mockUserModel.findOne.mockResolvedValueOnce(createUserDoc({ _id: "guest-user-2", guestSessionId: "session-2" }));
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({ _id: "guest-user-2", guestSessionId: "session-2" }));
    mockUserModel.findOne.mockReset();
    mockUserModel.findOne.mockResolvedValueOnce(null);
    mockGuestSession.convertSession.mockRejectedValueOnce(new Error("convert failed"));
    await request(app)
      .post("/api/auth/guest/convert")
      .set("x-test-user", JSON.stringify({ id: "guest-user-2", isTemporaryGuest: true, guestSessionId: "session-2", email: "guest@example.com" }))
      .send({ name: "A", email: "new2@example.com", password: "secret123" })
      .expect(500);
  });

  it("reports and extends guest sessions using authenticated guest access", async () => {
    mockGuestSession.getSessionStatus.mockResolvedValue({ sessionId: "session-1", remainingMs: 1000 });
    mockGuestSession.extendSession.mockResolvedValue({ _id: "session-1", expiresAt: new Date(Date.now() + 7200000), extensionCount: 1 });
    mockGuestSession.findById.mockResolvedValue({ _id: "session-1", status: "active", expiresAt: new Date(Date.now() + 1000) });
    mockUserModel.findOne.mockResolvedValue(createUserDoc({ guestSessionId: "session-1" }));

    const app = buildApp();
    const guestUser = {
      id: "guest-user-1",
      isTemporaryGuest: true,
      guestSessionId: "session-1",
      role: "guest",
      email: "guest@example.com",
      name: "Guest",
    };

    await request(app)
      .get("/api/auth/guest/status")
      .set("x-test-user", JSON.stringify(guestUser))
      .expect(200);

    await request(app)
      .post("/api/auth/guest/extend")
      .set("x-test-user", JSON.stringify(guestUser))
      .expect(200);

    await request(app)
      .get("/api/auth/guest/status")
      .set("x-test-user", JSON.stringify({ ...guestUser, isTemporaryGuest: false }))
      .expect(400);
  });

  it("converts a guest account and handles validation and conflict branches", async () => {
    const guestUser = createUserDoc({ _id: "guest-user-1", guestSessionId: "session-1", isTemporaryGuest: true });
    mockUserModel.findOne.mockResolvedValueOnce(guestUser).mockResolvedValueOnce(null).mockResolvedValueOnce(createUserDoc());
    mockUserModel.findById.mockResolvedValue(guestUser);
    mockGuestSession.convertSession.mockResolvedValue({ _id: "session-1" });
    bcrypt.hash.mockResolvedValue("hashed-password");

    const app = buildApp();

    await request(app)
      .post("/api/auth/guest/convert")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: false }))
      .send({ name: "A", email: "a@example.com", password: "secret123" })
      .expect(400);

    await request(app)
      .post("/api/auth/guest/convert")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: true, guestSessionId: "session-1", email: "guest@example.com" }))
      .send({ name: "A", email: "bad", password: "1" })
      .expect(400);

    await request(app)
      .post("/api/auth/guest/convert")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: true, guestSessionId: "session-1", email: "guest@example.com" }))
      .send({ name: "A", email: "used@example.com", password: "secret123" })
      .expect(409);

    const response = await request(app)
      .post("/api/auth/guest/convert")
      .set("x-test-user", JSON.stringify({ id: "guest-user-1", isTemporaryGuest: true, guestSessionId: "session-1", email: "guest@example.com" }))
      .send({ name: "A", email: "new@example.com", password: "secret123" })
      .expect(200);

    expect(response.body.user.isTemporaryGuest).toBe(false);
    expect(mockGuestSession.convertSession).toHaveBeenCalledWith("session-1");
  });
});