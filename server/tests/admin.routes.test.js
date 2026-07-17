const express = require("express");
const request = require("supertest");

jest.mock("../middleware/roleAuth", () => ({
  requireRole: jest.fn(() => (req, res, next) => {
    req.user = { id: "admin-1", role: "admin" };
    next();
  }),
}));

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logError: jest.fn(),
  logCleanup: jest.fn(),
}));

jest.mock("../utils/storageHelpers", () => ({
  formatBytes: jest.fn((bytes) => `${bytes} B`),
  getDirectorySize: jest.fn(async () => 0),
}));

jest.mock("../utils/fileHelpers", () => ({
  getUserUploadDir: jest.fn(() => "/tmp/test-user"),
}));

jest.mock("../utils/redisCache", () => ({
  invalidateUserCache: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

jest.mock("fs", () => ({
  promises: {
    rm: jest.fn().mockResolvedValue(undefined),
  },
}));

function createUserDoc(overrides = {}) {
  const doc = {
    _id: overrides._id || "user-1",
    name: overrides.name || "Test User",
    email: overrides.email || "user@example.com",
    role: overrides.role || "user",
    storageLimit: overrides.storageLimit ?? 5242880000,
    storageUsed: overrides.storageUsed ?? 0,
    dashboardPreferences: overrides.dashboardPreferences || null,
    save: jest.fn().mockImplementation(async () => doc),
    select: jest.fn().mockImplementation(async () => doc),
    toObject: jest.fn().mockImplementation(() => ({
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      storageLimit: doc.storageLimit,
      storageUsed: doc.storageUsed,
      dashboardPreferences: doc.dashboardPreferences,
    })),
  };

  return doc;
}

const mockUserModel = jest.fn((data) => createUserDoc(data));
mockUserModel.countDocuments = jest.fn();
mockUserModel.aggregate = jest.fn();
mockUserModel.find = jest.fn();
mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();
mockUserModel.findByIdAndDelete = jest.fn();

jest.mock("../models/User", () => mockUserModel);

jest.mock("../models/File", () => ({
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock("../models/Folder", () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock("../models/UploadSession", () => ({
  countDocuments: jest.fn(),
  cleanupExpiredSessions: jest.fn(),
  deleteMany: jest.fn(),
}));

const User = require("../models/User");
const File = require("../models/File");
const Folder = require("../models/Folder");
const UploadSession = require("../models/UploadSession");
const { getDirectorySize } = require("../utils/storageHelpers");
const fs = require("fs");
const adminRouter = require("../routes/admin");

const createQueryChain = (result) => {
  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: () => chain,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
  };

  return chain;
};

const buildApp = () => {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  return app;
};

describe("admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters users by the user role", async () => {
    const users = [
      {
        _id: "user-1",
        name: "Regular User",
        email: "user@example.com",
        role: "user",
        storageUsed: 1024,
        toObject() {
          return {
            _id: this._id,
            name: this.name,
            email: this.email,
            role: this.role,
            storageUsed: this.storageUsed,
          };
        },
      },
    ];

    User.find.mockReturnValue(createQueryChain(users));
    User.countDocuments.mockResolvedValue(1);
    File.aggregate.mockResolvedValue([{ _id: "user-1", count: 3 }]);

    const app = buildApp();
    const response = await request(app).get("/api/admin/users?role=user");

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({ role: "user" });
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].fileCount).toBe(3);
  });

  it("uses trashedAt when filtering trash stats by date range", async () => {
    User.countDocuments.mockResolvedValue(2);
    User.aggregate.mockResolvedValue([]);
    User.find.mockReturnValue(createQueryChain([]));
    File.countDocuments
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    File.aggregate.mockResolvedValue([]);
    Folder.countDocuments.mockResolvedValue(0);
    UploadSession.countDocuments.mockResolvedValue(0);
    getDirectorySize.mockResolvedValue(0);

    const app = buildApp();
    const response = await request(app).get(
      "/api/admin/stats?startDate=2026-01-01T00:00:00.000Z&endDate=2026-01-31T23:59:59.999Z&role=user",
    );

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({ role: "user" });
    expect(File.countDocuments).toHaveBeenCalledTimes(2);
    expect(File.countDocuments.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        trash: true,
        trashedAt: expect.objectContaining({
          $gte: new Date("2026-01-01T00:00:00.000Z"),
          $lte: new Date("2026-01-31T23:59:59.999Z"),
        }),
      }),
    );
  });

  it("rejects internal admin bootstrap requests from non-localhost addresses", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/api/admin/internal/create-admin")
      .set("X-Forwarded-For", "203.0.113.10")
      .send({ name: "Admin", email: "admin@example.com", password: "secret123" });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/localhost/i);
  });

  it("creates and rejects internal admin bootstrap requests", async () => {
    const app = buildApp();

    await request(app)
      .post("/api/admin/internal/create-admin")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({ name: "", email: "bad", password: "123" })
      .expect(400);

    User.findOne.mockResolvedValueOnce(createUserDoc({ email: "existing@example.com" }));
    await request(app)
      .post("/api/admin/internal/create-admin")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({ name: "Admin", email: "existing@example.com", password: "secret123" })
      .expect(409);

    User.findOne.mockReset();
    User.findOne.mockResolvedValueOnce(null);
    const response = await request(app)
      .post("/api/admin/internal/create-admin")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({ name: "Admin", email: "admin@example.com", password: "secret123" })
      .expect(201);

    expect(response.body.user.role).toBe("admin");
  });

  it("promotes internal users and rejects invalid requests", async () => {
    const app = buildApp();

    await request(app)
      .post("/api/admin/internal/promote-user")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({})
      .expect(400);

    await request(app)
      .post("/api/admin/internal/promote-user")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({ email: "promote@example.com", newRole: "invalid" })
      .expect(400);

    User.findOne.mockResolvedValueOnce(null);
    await request(app)
      .post("/api/admin/internal/promote-user")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({ email: "missing@example.com", newRole: "admin" })
      .expect(404);

    const promotedUser = createUserDoc({ email: "promote@example.com", role: "user" });
    User.findOne.mockReset();
    User.findOne.mockResolvedValueOnce(promotedUser);
    const response = await request(app)
      .post("/api/admin/internal/promote-user")
      .set("X-Forwarded-For", "127.0.0.1")
      .send({ email: "promote@example.com", newRole: "family" })
      .expect(200);

    expect(response.body.user.role).toBe("family");
  });

  it("loads and saves dashboard preferences", async () => {
    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        dashboardPreferences: {
          visibleWidgets: ["storageCapacity"],
          widgetOrder: [{ i: "storageCapacity", x: 0, y: 0, w: 2, h: 2 }],
        },
      }),
    });

    const app = buildApp();

    const getResponse = await request(app).get("/api/admin/dashboard/preferences");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.visibleWidgets).toEqual(["storageCapacity"]);

    const invalidWidgets = await request(app)
      .put("/api/admin/dashboard/preferences")
      .send({ visibleWidgets: "not-an-array" });
    expect(invalidWidgets.status).toBe(400);

    User.findById.mockReset();
    User.findById.mockResolvedValueOnce({
      dashboardPreferences: null,
      save: jest.fn().mockResolvedValue(undefined),
    });

    const saveResponse = await request(app)
      .put("/api/admin/dashboard/preferences")
      .send({
        visibleWidgets: ["storageCapacity", "activityTimeline"],
        widgetOrder: [{ i: "storageCapacity", x: 0, y: 0, w: 2, h: 2 }],
      });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.preferences.visibleWidgets).toEqual([
      "storageCapacity",
      "activityTimeline",
    ]);
  });

  it("updates user roles and deletes users and files", async () => {
    const app = buildApp();

    await request(app)
      .put("/api/admin/users/user-1/role")
      .send({ role: "invalid" })
      .expect(400);

    await request(app)
      .put("/api/admin/users/admin-1/role")
      .send({ role: "family" })
      .expect(400);

    User.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) });
    await request(app)
      .put("/api/admin/users/user-2/role")
      .send({ role: "family" })
      .expect(404);

    User.findById.mockReset();
    User.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc({ role: "guest" })) });
    await request(app)
      .put("/api/admin/users/user-3/role")
      .send({ role: "family" })
      .expect(400);

    User.findById.mockReset();
    User.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(createUserDoc({ role: "user" })) });
    const updateResponse = await request(app)
      .put("/api/admin/users/user-4/role")
      .send({ role: "family" })
      .expect(200);
    expect(updateResponse.body.user.role).toBe("family");

    await request(app)
      .delete("/api/admin/users/admin-1")
      .expect(400);

    User.findById.mockReset();
    User.findById.mockResolvedValueOnce(null);
    await request(app).delete("/api/admin/users/missing-user").expect(404);

    const deletableUser = createUserDoc({ _id: "user-delete-1" });
    User.findById.mockReset();
    User.findById.mockResolvedValueOnce(deletableUser);
    File.deleteMany.mockResolvedValueOnce({ deletedCount: 2 });
    Folder.deleteMany.mockResolvedValueOnce({ deletedCount: 1 });
    UploadSession.deleteMany.mockResolvedValueOnce({ deletedCount: 1 });
    User.findByIdAndDelete.mockResolvedValueOnce(deletableUser);

    const deleteResponse = await request(app).delete("/api/admin/users/user-delete-1").expect(200);
    expect(deleteResponse.body.deletedFiles).toBe(2);

    File.findById.mockResolvedValueOnce({
      _id: "file-1",
      name: "file.txt",
      size: 100,
      owner: "user-1",
    });
    User.findById.mockReset();
    User.findById.mockResolvedValueOnce(createUserDoc({ _id: "user-1", storageUsed: 1000 }));
    File.findByIdAndDelete.mockResolvedValueOnce({});
    await request(app).delete("/api/admin/files/file-1").expect(200);

    File.findById.mockResolvedValueOnce(null);
    await request(app).delete("/api/admin/files/missing-file").expect(404);
  });

  it("returns 404 and 500 when dashboard preferences cannot be loaded or saved", async () => {
    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue(null),
    });

    const app = buildApp();
    await request(app).get("/api/admin/dashboard/preferences").expect(404);

    User.findById.mockReset();
    User.findById.mockRejectedValueOnce(new Error("db down"));
    await request(app)
      .put("/api/admin/dashboard/preferences")
      .send({ visibleWidgets: ["storageCapacity"] })
      .expect(500);
  });
});