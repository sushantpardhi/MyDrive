const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs").promises;
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
    createdAt: overrides.createdAt || new Date("2026-01-01T00:00:00.000Z"),
    lastStorageNotificationLevel: overrides.lastStorageNotificationLevel || 0,
    settings: overrides.settings || { theme: "light" },
    preferences: overrides.preferences || { viewMode: "list" },
    tags: overrides.tags || [],
    save: jest.fn().mockImplementation(async () => doc),
    select: jest.fn().mockImplementation(async () => doc),
    toObject: jest.fn().mockImplementation(() => ({ ...doc })),
  };
  return doc;
};

const mockUserModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock("../models/User", () => mockUserModel);
jest.mock("../models/File", () => ({
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock("../models/Folder", () => ({
  countDocuments: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock("../middleware/roleAuth", () => ({
  requireAdmin: jest.fn((req, res, next) => {
    req.user = req.user || { id: "admin-1", role: "admin" };
    next();
  }),
}));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock("../utils/redisCache", () => ({
  invalidateUserCache: jest.fn(),
}));
jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
jest.mock("../utils/storageHelpers", () => ({
  formatBytes: jest.fn((bytes) => `${bytes} B`),
}));
jest.mock("../utils/fileHelpers", () => ({
  getUserUploadDir: jest.fn((userId) => `/tmp/${userId}`),
}));

const bcrypt = require("bcryptjs");
const File = require("../models/File");
const Folder = require("../models/Folder");
const redisCache = require("../utils/redisCache");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.user = { id: "user-1", role: "admin" };
    next();
  });
  app.use("/api/users", require("../routes/users"));
  return app;
};

describe("users routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserModel.findById.mockReset();
    mockUserModel.findByIdAndUpdate.mockReset();
    mockUserModel.findByIdAndDelete.mockReset();
    mockUserModel.find.mockReset();
    mockUserModel.countDocuments.mockReset();
    mockUserModel.deleteMany.mockReset();
    mockUserModel.updateMany.mockReset();
    bcrypt.compare.mockReset();
    bcrypt.hash.mockReset();
    jest.spyOn(fs, "rm").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads and updates the profile", async () => {
    mockUserModel.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc()) });
    mockUserModel.findByIdAndUpdate.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc({ name: "Updated" })) });

    const app = buildApp();
    await request(app).get("/api/users/profile").expect(200);

    const response = await request(app)
      .put("/api/users/profile")
      .send({ name: "Updated" })
      .expect(200);

    expect(response.body.user.name).toBe("Updated");
  });

  it("manages tags and invalid tag input", async () => {
    const user = createUserDoc({ tags: [{ _id: "tag-1", name: "Work" }] });
    mockUserModel.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(user) });
    File.updateMany.mockResolvedValue({});
    Folder.updateMany.mockResolvedValue({});

    const app = buildApp();

    await request(app).post("/api/users/tags").send({ name: "" }).expect(400);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({ tags: [] }));
    const createResponse = await request(app).post("/api/users/tags").send({ name: "Personal" }).expect(201);
    expect(createResponse.body.name).toBe("Personal");

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue(createUserDoc({ tags: [{ _id: "tag-1", name: "Work" }] })),
    });
    await request(app).get("/api/users/tags").expect(200);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({ tags: [{ _id: "tag-1", name: "Work" }] }));
    await request(app).delete("/api/users/tags/tag-1").expect(200);
  });

  it("returns storage, stats, and search results", async () => {
    mockUserModel.findById
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc({ storageUsed: 100, storageLimit: 1000 })) })
      .mockResolvedValueOnce(createUserDoc({ createdAt: new Date("2026-01-01T00:00:00.000Z") }))
      .mockResolvedValueOnce(createUserDoc({ password: "hashed-password" }));

    File.aggregate.mockResolvedValue([{ totalSize: 100, count: 1 }]);
    File.countDocuments
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    Folder.countDocuments.mockResolvedValue(3);
    mockUserModel.find.mockReturnValue({ select: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });

    const app = buildApp();
    await request(app).get("/api/users/storage").expect(200);
    await request(app).get("/api/users/stats").expect(200);
    await request(app).get("/api/users/search?query=ab").expect(200);
  });

  it("handles password verification and change flows", async () => {
    const user = createUserDoc({ password: "hashed-password", passwordHistory: ["old-hash"] });
    mockUserModel.findById
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user);
    bcrypt.compare
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    bcrypt.hash.mockResolvedValue("new-hash");

    const app = buildApp();
    await request(app).post("/api/users/verify-password").send({}).expect(400);
    await request(app).post("/api/users/verify-password").send({ password: "bad" }).expect(401);
    await request(app).post("/api/users/verify-password").send({ password: "good" }).expect(200);

    bcrypt.compare.mockReset();
    bcrypt.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockUserModel.findById.mockResolvedValue(user);
    await request(app).put("/api/users/change-password").send({}).expect(400);
    await request(app).put("/api/users/change-password").send({ currentPassword: "wrong", newPassword: "newpass123" }).expect(401);
    await request(app).put("/api/users/change-password").send({ currentPassword: "good", newPassword: "newpass123" }).expect(200);
  });

  it("returns account stats, deletes accounts, and handles admin endpoints", async () => {
    const user = createUserDoc({ role: "admin" });
    mockUserModel.findById.mockReset();
    mockUserModel.findById
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([user]) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(user) })
      .mockResolvedValueOnce(user);
    mockUserModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([user]),
    });
    mockUserModel.findByIdAndDelete.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);

    File.deleteMany.mockResolvedValue({ deletedCount: 2 });
    Folder.deleteMany.mockResolvedValue({ deletedCount: 1 });

    const app = buildApp();
    await request(app).get("/api/users/all").expect(200);
    await request(app).get("/api/users/user-2").expect(200);

    mockUserModel.findById.mockReset();
    mockUserModel.findById
      .mockResolvedValueOnce(user)
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(user) });
    await request(app).put("/api/users/user-2/role").send({ role: "family" }).expect(200);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      storageUsed: 100,
      storageLimit: 1000,
      password: "hashed-password",
      role: "admin",
    }));
    await request(app).get("/api/users/stats").expect(200);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({
      password: "hashed-password",
      role: "admin",
    }));
    bcrypt.compare.mockReset();
    bcrypt.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await request(app).delete("/api/users/account").send({}).expect(400);
    await request(app).delete("/api/users/account").send({ password: "bad" }).expect(401);
    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(createUserDoc({
      password: "hashed-password",
      role: "admin",
    }));
    await request(app).delete("/api/users/account").send({ password: "good" }).expect(200);

    expect(redisCache.invalidateUserCache).toHaveBeenCalled();
  });

  it("returns 404 for missing users and rejects self role changes", async () => {
    const app = buildApp();

    mockUserModel.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue(null),
    });
    await request(app).get("/api/users/missing-user").expect(404);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(
      createUserDoc({ _id: "user-1", role: "admin" }),
    );
    await request(app)
      .put("/api/users/user-1/role")
      .send({ role: "family" })
      .expect(403);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockResolvedValueOnce(null);
    await request(app)
      .put("/api/users/user-2/role")
      .send({ role: "family" })
      .expect(404);
  });

  it("returns 500 when role updates or user lookups fail", async () => {
    const app = buildApp();

    mockUserModel.findById.mockResolvedValueOnce({
      role: "user",
      save: jest.fn().mockRejectedValueOnce(new Error("save failed")),
    });

    await request(app)
      .put("/api/users/user-2/role")
      .send({ role: "family" })
      .expect(500);

    mockUserModel.findById.mockReset();
    mockUserModel.findById.mockReturnValueOnce({
      select: jest.fn().mockRejectedValueOnce(new Error("lookup failed")),
    });

    await request(app).get("/api/users/user-2").expect(500);
  });

  it("returns 500 when user listing or deletion fails", async () => {
    const app = buildApp();

    mockUserModel.find.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockRejectedValueOnce(new Error("list failed")),
    });
    await request(app).get("/api/users/all").expect(500);

    mockUserModel.findById.mockResolvedValueOnce({
      select: jest.fn().mockResolvedValue(createUserDoc({ password: "hashed-password", role: "admin" })),
    });
    bcrypt.compare.mockResolvedValueOnce(true);
    mockUserModel.findByIdAndDelete.mockRejectedValueOnce(new Error("delete failed"));

    await request(app)
      .delete("/api/users/account")
      .send({ password: "good" })
      .expect(500);
  });

  it("covers invalid role updates and storage lookup failures", async () => {
    const app = buildApp();

    await request(app)
      .put("/api/users/user-2/role")
      .send({ role: "superuser" })
      .expect(400);

    mockUserModel.findById.mockReturnValueOnce({
      select: jest.fn().mockRejectedValueOnce(new Error("storage lookup failed")),
    });
    await request(app).get("/api/users/storage").expect(500);
  });
});