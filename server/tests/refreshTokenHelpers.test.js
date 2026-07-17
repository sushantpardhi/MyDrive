jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("refreshTokenHelpers", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.REFRESH_TOKEN_SECRET =
      "unit-test-refresh-secret-unit-test-refresh-secret";
    process.env.REFRESH_TOKEN_EXPIRATION = "30d";
  });

  afterEach(() => {
    delete process.env.REFRESH_TOKEN_SECRET;
    delete process.env.REFRESH_TOKEN_EXPIRATION;
  });

  it("generates and stores refresh tokens", async () => {
    const redisQueue = {
      isConnected: true,
      client: {
        lPush: jest.fn(),
        lTrim: jest.fn(),
        expire: jest.fn(),
        lRange: jest.fn(),
        lRem: jest.fn(),
        del: jest.fn(),
      },
    };

    jest.doMock("../utils/redisQueue", () => redisQueue);
    const { generateRefreshToken } = require("../utils/refreshTokenHelpers");
    const token = await generateRefreshToken({
      _id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "user",
    });

    expect(typeof token).toBe("string");
    expect(redisQueue.client.lPush).toHaveBeenCalledTimes(1);
    expect(redisQueue.client.lTrim).toHaveBeenCalledTimes(1);
    expect(redisQueue.client.expire).toHaveBeenCalledWith(
      "auth:sessions:user-1",
      2592000,
    );
  });

  it("validates stored refresh tokens", async () => {
    const redisQueue = {
      isConnected: true,
      client: {
        lPush: jest.fn(),
        lTrim: jest.fn(),
        expire: jest.fn(),
        lRange: jest.fn(),
        lRem: jest.fn(),
        del: jest.fn(),
      },
    };

    jest.doMock("../utils/redisQueue", () => redisQueue);
    const { generateRefreshToken, validateRefreshToken } = require("../utils/refreshTokenHelpers");
    const token = await generateRefreshToken({
      _id: "user-2",
      email: "user2@example.com",
      name: "User 2",
      role: "admin",
    });

    redisQueue.client.lRange.mockResolvedValue([token]);

    const payload = await validateRefreshToken(token);

    expect(payload).toMatchObject({ id: "user-2", role: "admin" });
  });

  it("revokes a token and can clear all sessions", async () => {
    const redisQueue = {
      isConnected: true,
      client: {
        lPush: jest.fn(),
        lTrim: jest.fn(),
        expire: jest.fn(),
        lRange: jest.fn(),
        lRem: jest.fn(),
        del: jest.fn(),
      },
    };

    jest.doMock("../utils/redisQueue", () => redisQueue);
    const { generateRefreshToken, revokeRefreshToken, revokeAllUserTokens } = require("../utils/refreshTokenHelpers");
    const token = await generateRefreshToken({
      _id: "user-3",
      email: "user3@example.com",
      name: "User 3",
      role: "family",
    });

    await revokeRefreshToken(token);
    await revokeAllUserTokens("user-3");

    expect(redisQueue.client.lRem).toHaveBeenCalledWith(
      "auth:sessions:user-3",
      1,
      token,
    );
    expect(redisQueue.client.del).toHaveBeenCalledWith("auth:sessions:user-3");
  });
});