const express = require("express");
const request = require("supertest");
const mockFileModel = {
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

const mockFolderModel = {
  findById: jest.fn(),
  find: jest.fn(),
};

jest.mock("multer", () => {
  const multer = jest.fn(() => ({
    single: () => (req, res, next) => next(),
  }));
  multer.diskStorage = jest.fn(() => ({}));
  multer.memoryStorage = jest.fn(() => ({}));
  return multer;
});

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  statSync: jest.fn(() => ({ size: 4, mtime: new Date("2026-01-01T00:00:00.000Z") })),
  createReadStream: jest.fn(() => {
    const { EventEmitter } = require("events");
    const stream = new EventEmitter();
    stream.destroyed = false;
    stream.destroy = jest.fn(() => {
      stream.destroyed = true;
      stream.emit("close");
    });
    stream.pipe = (res) => {
      if (res && typeof res.jpeg === "function") {
        return res;
      }

      process.nextTick(() => {
        if (!stream.destroyed) {
          res.end("data");
          stream.emit("end");
          stream.emit("close");
        }
      });
      return res;
    };
    return stream;
  }),
}));

jest.mock("sharp", () =>
  jest.fn(() => {
    const { EventEmitter } = require("events");
    const transform = new EventEmitter();
    transform.destroyed = false;
    transform.destroy = jest.fn(() => {
      transform.destroyed = true;
      transform.emit("close");
    });
    transform.jpeg = jest.fn(() => transform);
    transform.toBuffer = jest.fn().mockResolvedValue(Buffer.from("jpeg"));
    transform.pipe = (res) => {
      process.nextTick(() => {
        if (!transform.destroyed) {
          const chunk = Buffer.from("jpeg");
          transform.emit("data", chunk);
          res.end(chunk);
          transform.emit("end");
          transform.emit("close");
        }
      });

      return res;
    };
    return transform;
  })
);

jest.mock("uuid", () => ({ v4: jest.fn(() => "uuid-1") }));
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "signed-token"),
  verify: jest.fn(),
}));

jest.mock("../models/File", () => mockFileModel);
jest.mock("../models/Folder", () => mockFolderModel);
jest.mock("../models/User", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock("../models/UploadSession", () => ({}));
jest.mock("../models/DownloadSession", () => ({
  generateDownloadId: jest.fn(() => "download-1"),
  findOne: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../utils/fileHelpers", () => ({
  ensureUserDir: jest.fn(() => "/tmp/user-1"),
  getUserFilePath: jest.fn(),
}));
jest.mock("../utils/emailService", () => ({}));
jest.mock("../middleware/guestAuth", () => ({
  requireNonTemporaryGuestFor: jest.fn(() => (req, res, next) => next()),
}));
jest.mock("../utils/storageHelpers", () => ({
  validateStorageForUpload: jest.fn(() => null),
  handlePostUploadNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/chunkHelpers", () => ({
  createTempUploadDir: jest.fn(),
  storeChunk: jest.fn(),
  verifyChunkIntegrity: jest.fn(),
  combineChunks: jest.fn(),
  calculateFileHash: jest.fn(),
  cleanupTempDir: jest.fn(),
  getFinalFilePath: jest.fn(),
  validateChunkSequence: jest.fn(),
  calculateUploadStats: jest.fn(),
  generateUploadId: jest.fn(() => "upload-1"),
}));
jest.mock("../utils/redisQueue", () => ({
  isImageFile: jest.fn(() => false),
  sendImageJob: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/lockHelpers", () => ({
  checkLockStatus: jest.fn(),
}));
jest.mock("../middleware/cache", () => ({
  cacheMiddleware: jest.fn(() => (req, res, next) => next()),
}));
jest.mock("../utils/redisCache", () => ({
  invalidateUserCache: jest.fn(),
}));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logError: jest.fn(),
  logFileOperation: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const sharp = require("sharp");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const rawUser = req.headers["x-test-user"];
    req.user = rawUser ? JSON.parse(rawUser) : { id: "user-1", role: "user" };
    next();
  });
  app.use("/api/files", require("../routes/files"));
  return app;
};

describe("file download routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks direct file download when the user lacks access", async () => {
    mockFileModel.findById.mockResolvedValue({
      _id: "file-1",
      name: "secret.pdf",
      path: "/tmp/secret.pdf",
      size: 4,
      type: "application/pdf",
      trash: false,
      owner: { toString: () => "owner-1" },
      shared: [],
    });

    const app = buildApp();
    const response = await request(app)
      .get("/api/files/download/file-1")
      .set("x-test-user", JSON.stringify({ id: "user-1", role: "user" }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Access denied");
  });

  it("blocks direct file streaming when the user lacks access", async () => {
    mockFileModel.findById.mockResolvedValue({
      _id: "file-1",
      name: "secret.mp4",
      path: "/tmp/secret.mp4",
      size: 4,
      type: "video/mp4",
      trash: false,
      owner: { toString: () => "owner-1" },
      shared: [],
    });

    const app = buildApp();
    const response = await request(app)
      .get("/api/files/stream/file-1")
      .set("x-test-user", JSON.stringify({ id: "user-1", role: "user" }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Access denied");
  });

  it("uses the stream token user as the authoritative identity", async () => {
    jwt.verify.mockReturnValue({
      purpose: "stream",
      fileId: "file-1",
      userId: "owner-1",
    });
    mockFileModel.findById.mockResolvedValue({
      _id: "file-1",
      name: "video.mp4",
      path: "/tmp/video.mp4",
      size: 4,
      type: "video/mp4",
      trash: false,
      owner: { toString: () => "owner-1" },
      shared: [],
    });

    const app = buildApp();
    const response = await request(app)
      .get("/api/files/stream/file-1?token=stream-token")
      .set("x-test-user", JSON.stringify({ id: "other-user", role: "user" }));

    expect(response.status).toBe(200);
  });

  it("streams HEIC conversion output without buffering the whole file", async () => {
    mockFileModel.findById.mockResolvedValue({
      _id: "file-2",
      name: "photo.heic",
      path: "/tmp/photo.heic",
      size: 4,
      type: "image/heic",
      trash: false,
      owner: { toString: () => "user-1" },
      shared: [],
    });

    const app = buildApp();
    const response = await request(app)
      .get("/api/files/download/file-2?convert=true")
      .set("x-test-user", JSON.stringify({ id: "user-1", role: "user" }));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/jpeg");
    expect(sharp).toHaveBeenCalledWith();
    expect(sharp.mock.results[0].value.toBuffer).not.toHaveBeenCalled();
  });
});