const mockLogger = {
  http: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("winston", () => ({
  addColors: jest.fn(),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    splat: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
  },
  transports: {
    Console: jest.fn(),
    DailyRotateFile: jest.fn(),
  },
  createLogger: jest.fn(() => mockLogger),
}));

jest.mock("winston-daily-rotate-file", () => ({}), { virtual: true });

describe("logger", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("formats common logging helpers", () => {
    const logger = require("../utils/logger");

    logger.logRequest(
      {
        ip: "127.0.0.1",
        connection: { remoteAddress: "127.0.0.1" },
        get: () => "agent",
        method: "GET",
        originalUrl: "/api/test",
        user: { id: "user-1" },
        id: "req-1",
      },
      "Request received",
    );
    logger.logError(new Error("boom"), {
      operation: "upload",
      userId: "user-1",
      ip: "127.0.0.1",
      additionalInfo: "extra",
    });
    logger.logFileOperation("uploaded", { filename: "file.txt", _id: "file-1" }, "user-1", {
      fileSize: 1024,
      mimeType: "text/plain",
      duration: 12,
      ip: "127.0.0.1",
    });
    logger.logAuth("login", "user-1", { ip: "127.0.0.1", userAgent: "agent", email: "u@example.com" });
    logger.logUpload("done", "file.txt", "user-1", { fileSize: 1024, uploadId: "up-1", chunks: 2, retries: 1, duration: 20, ip: "127.0.0.1" });
    logger.logChunk("up-1", 0, 3, "user-1", { chunkSize: 1024, hash: "abcdef123456", retryCount: 2 });
    logger.logFolderOperation("created", { name: "Folder", _id: "folder-1" }, "user-1", { parent: "root", itemCount: 5, ip: "127.0.0.1" });
    logger.logShare("shared", { name: "File", _id: "file-1" }, "user-1", { sharedWith: ["u2"], resourceType: "file", permissions: "read", ip: "127.0.0.1" });
    logger.logEmail("sent", "user@example.com", "Hello", { duration: 8 });
    logger.logEmail("failed", "user@example.com", "Hello", { error: "smtp down" });
    logger.logDatabase("query", "users", { query: { a: 1 }, result: 3, duration: 5, error: "db boom" });
    logger.logCleanup("trash-cleanup", { itemsRemoved: 2, spaceFreed: 2048, duration: 7 });
    logger.logPerformance("render", 2000, { threshold: 1000, additionalInfo: "slow path" });
    logger.logPerformance("render", 10, { threshold: 1000 });
    logger.stream.write("stream message\n");

    expect(mockLogger.http).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});