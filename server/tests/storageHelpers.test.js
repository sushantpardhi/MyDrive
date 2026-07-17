jest.mock("../utils/logger", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../utils/emailService", () => ({
  sendStorageLimitReachedEmail: jest.fn(),
  sendStorageWarningEmail: jest.fn(),
}));

jest.mock("../models/User", () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const fs = require("fs");
const emailService = require("../utils/emailService");
const User = require("../models/User");

const {
  checkStorageAvailability,
  getNotificationThreshold,
  shouldNotifyUser,
  formatBytes,
  validateStorageForUpload,
  NOTIFICATION_THRESHOLDS,
} = require("../utils/storageHelpers");

describe("storageHelpers", () => {
  it("formats byte counts", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536, 1)).toBe("1.5 KB");
  });

  it("treats unlimited users as having space", () => {
    const result = checkStorageAvailability(
      { _id: "u1", role: "admin", storageUsed: 10, storageLimit: -1 },
      5000,
    );

    expect(result).toMatchObject({
      hasSpace: true,
      isUnlimited: true,
      limit: -1,
      newUsage: 5010,
    });
  });

  it("returns an error when a user exceeds storage", () => {
    const error = validateStorageForUpload(
      { _id: "u1", role: "user", storageUsed: 900, storageLimit: 1000 },
      200,
    );

    expect(error).toMatchObject({
      code: "STORAGE_LIMIT_EXCEEDED",
      details: expect.objectContaining({
        currentUsage: 900,
        limit: 1000,
      }),
    });
  });

  it("maps usage percentages to notification thresholds", () => {
    expect(getNotificationThreshold(49)).toBeNull();
    expect(getNotificationThreshold(50)).toBe(NOTIFICATION_THRESHOLDS.WARNING_50);
    expect(getNotificationThreshold(90)).toBe(NOTIFICATION_THRESHOLDS.WARNING_90);
    expect(getNotificationThreshold(100)).toBe(NOTIFICATION_THRESHOLDS.LIMIT_100);
  });

  it("only notifies when the threshold increases", () => {
    expect(shouldNotifyUser({ lastStorageNotificationLevel: 50 }, 75)).toBe(true);
    expect(shouldNotifyUser({ lastStorageNotificationLevel: 75 }, 75)).toBe(false);
  });

  it("sends storage notifications and handles upload notification branches", async () => {
    const {
      sendStorageNotification,
      handlePostUploadNotification,
      getDirectorySize,
    } = require("../utils/storageHelpers");

    await sendStorageNotification(
      { _id: "u1", email: "user@example.com" },
      NOTIFICATION_THRESHOLDS.WARNING_75,
      { percentage: 75 },
    );

    await sendStorageNotification(
      { _id: "u2", email: "user2@example.com" },
      NOTIFICATION_THRESHOLDS.LIMIT_100,
      { percentage: 100 },
    );

    emailService.sendStorageWarningEmail.mockRejectedValueOnce(new Error("mail boom"));
    await sendStorageNotification(
      { _id: "u3", email: "user3@example.com" },
      NOTIFICATION_THRESHOLDS.WARNING_50,
      { percentage: 50 },
    );

    User.findById.mockResolvedValueOnce(null);
    await handlePostUploadNotification({ _id: "u4" }, 10);

    User.findById.mockResolvedValueOnce({
      _id: "u5",
      role: "admin",
      storageLimit: -1,
      storageUsed: 1,
    });
    await handlePostUploadNotification({ _id: "u5" }, 10);

    User.findById.mockResolvedValueOnce({
      _id: "u6",
      role: "user",
      storageLimit: 1000,
      storageUsed: 800,
      lastStorageNotificationLevel: 0,
    });
    User.findOneAndUpdate.mockResolvedValueOnce({ _id: "u6" });
    await handlePostUploadNotification({ _id: "u6" }, 10);

    const originalReaddir = fs.promises.readdir;
    const originalStat = fs.promises.stat;

    fs.promises.readdir = jest
      .fn()
      .mockResolvedValueOnce([
        { name: "file.txt", isDirectory: () => false },
        { name: "nested", isDirectory: () => true },
      ])
      .mockResolvedValueOnce([]);
    fs.promises.stat = jest.fn().mockResolvedValue({ size: 12 });

    await expect(getDirectorySize("/tmp/test-dir")).resolves.toBe(12);

    fs.promises.readdir = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "EACCES" }));
    await expect(getDirectorySize("/tmp/test-dir")).resolves.toBe(0);

    fs.promises.readdir = originalReaddir;
    fs.promises.stat = originalStat;
  });

  it("handles directory size errors and validation for unlimited users", async () => {
    const originalReaddir = fs.promises.readdir;
    const originalStat = fs.promises.stat;

    fs.promises.readdir = jest.fn().mockRejectedValueOnce(Object.assign(new Error("permission denied"), { code: "EACCES" }));
    await expect(require("../utils/storageHelpers").getDirectorySize("/nope")).resolves.toBe(0);

    fs.promises.readdir = jest.fn().mockResolvedValueOnce([{ name: "file.txt", isDirectory: () => false }]);
    fs.promises.stat = jest.fn().mockResolvedValue({ size: 7 });
    await expect(require("../utils/storageHelpers").getDirectorySize("/tmp/dir" )).resolves.toBe(7);

    const unlimited = validateStorageForUpload({ _id: "u2", role: "admin", storageUsed: 10, storageLimit: -1 }, 1000);
    expect(unlimited).toBeNull();

    User.findById.mockRejectedValueOnce(new Error("notify failed"));
    await require("../utils/storageHelpers").handlePostUploadNotification({ _id: "u3", role: "user" }, 10);

    fs.promises.readdir = originalReaddir;
    fs.promises.stat = originalStat;
  });
});