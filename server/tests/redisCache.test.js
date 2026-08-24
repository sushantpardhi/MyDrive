const mockRedisClient = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn(),
  scan: jest.fn(),
  unlink: jest.fn(),
};

jest.mock("redis", () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("redisCache", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("connects, sets, gets, invalidates, and disconnects", async () => {
    const redisCache = require("../utils/redisCache");

    await redisCache.connect();
    expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);

    redisCache.isConnected = true;
    mockRedisClient.get.mockResolvedValue(JSON.stringify({ a: 1 }));
    mockRedisClient.scan
      .mockResolvedValueOnce({ cursor: "1", keys: ["cache:user-1:a"] })
      .mockResolvedValueOnce({ cursor: "0", keys: [] });

    await expect(redisCache.set("cache:user-1:test", { ok: true }, 60)).resolves.toBe(true);
    await expect(redisCache.get("cache:user-1:test")).resolves.toEqual({ a: 1 });
    await expect(redisCache.invalidateUserCache("user-1")).resolves.toBe(true);
    await expect(redisCache.disconnect()).resolves.toBeUndefined();

    expect(mockRedisClient.setEx).toHaveBeenCalledWith("cache:user-1:test", 60, JSON.stringify({ ok: true }));
    expect(mockRedisClient.unlink).toHaveBeenCalledWith(["cache:user-1:a"]);
    expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
  });

  it("returns safe fallbacks when disconnected", async () => {
    const redisCache = require("../utils/redisCache");

    redisCache.isConnected = false;
    redisCache.client = null;

    await expect(redisCache.get("key")).resolves.toBeNull();
    await expect(redisCache.set("key", { a: 1 })).resolves.toBe(false);
    await expect(redisCache.invalidateUserCache("user-1")).resolves.toBe(false);
  });

  it("handles redis client errors and connect failures", async () => {
    const redisCache = require("../utils/redisCache");

    mockRedisClient.connect.mockRejectedValueOnce(new Error("connect failed"));
    await redisCache.connect();

    redisCache.isConnected = true;
    redisCache.client = mockRedisClient;

    mockRedisClient.get.mockRejectedValueOnce(new Error("get failed"));
    mockRedisClient.setEx.mockRejectedValueOnce(new Error("set failed"));
    mockRedisClient.scan.mockRejectedValueOnce(new Error("scan failed"));

    await expect(redisCache.get("key")).resolves.toBeNull();
    await expect(redisCache.set("key", { a: 1 })).resolves.toBe(false);
    await expect(redisCache.invalidateUserCache("user-1")).resolves.toBe(false);
  });

  it("handles redis event callbacks and parse failures", async () => {
    const redisCache = require("../utils/redisCache");

    redisCache.isConnected = true;
    redisCache.client = mockRedisClient;
    await redisCache.connect();

    await redisCache.connect();
    const connectHandler = mockRedisClient.on.mock.calls.find(([event]) => event === "connect")?.[1];
    const errorHandler = mockRedisClient.on.mock.calls.find(([event]) => event === "error")?.[1];
    const disconnectHandler = mockRedisClient.on.mock.calls.find(([event]) => event === "disconnect")?.[1];

    connectHandler?.();
    errorHandler?.(new Error("boom"));
    disconnectHandler?.();

    redisCache.isConnected = true;
    redisCache.client = mockRedisClient;
    mockRedisClient.get.mockResolvedValueOnce("not-json");
    await expect(redisCache.get("key")).resolves.toBeNull();

    mockRedisClient.get.mockResolvedValueOnce(null);
    await expect(redisCache.get("missing")).resolves.toBeNull();

    mockRedisClient.scan
      .mockResolvedValueOnce({ cursor: "0", keys: [] });
    await expect(redisCache.invalidateUserCache("user-2")).resolves.toBe(true);
  });
});