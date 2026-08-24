describe("envValidator", () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    jest.doMock("../utils/logger", () => logger);
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.REFRESH_TOKEN_SECRET;
    delete process.env.MONGODB_URI;
    delete process.env.EMAIL_USER;
    delete process.env.CLIENT_URL;
    delete process.env.CORS_ORIGIN;
    delete process.env.PORT;
    delete process.env.CHUNK_SIZE;
    delete process.env.MAX_CHUNK_SIZE;
    delete process.env.UPLOAD_TIMEOUT;
    delete process.env.SESSION_LOOKUP_TIMEOUT;
    delete process.env.GUEST_SESSION_DURATION;
    delete process.env.GUEST_SESSION_EXTENSION;
    delete process.env.GUEST_MAX_EXTENSIONS;
    delete process.env.GUEST_STORAGE_LIMIT;
    delete process.env.NODE_ENV;
  });

  it("throws when required env vars are missing", () => {
    const { validateRequiredEnvVars } = require("../utils/envValidator");

    expect(() => validateRequiredEnvVars()).toThrow(/Missing required environment variables/);
  });

  it("accepts a complete configuration and returns a summary", () => {
    process.env.JWT_SECRET = "unit-test-jwt-secret-unit-test-jwt-secret";
    process.env.REFRESH_TOKEN_SECRET = "unit-test-refresh-secret-unit-test-refresh-secret";
    process.env.MONGODB_URI = "mongodb://localhost:27017/mydrive";
    process.env.EMAIL_USER = "user@example.com";
    process.env.CLIENT_URL = "http://localhost:3000";
    process.env.CORS_ORIGIN = "http://localhost:3000";
    process.env.PORT = "8080";

    const { validateRequiredEnvVars, getConfigSummary } = require("../utils/envValidator");

    expect(() => validateRequiredEnvVars()).not.toThrow();
    expect(getConfigSummary()).toMatchObject({
      nodeEnv: "development",
      port: "8080",
      mongodbConfigured: true,
      emailConfigured: true,
      corsOrigin: "http://localhost:3000",
    });
  });

  it("warns on weak and malformed environment settings", () => {
    process.env.JWT_SECRET = "secret";
    process.env.REFRESH_TOKEN_SECRET = "refresh-secret-key-change-in-production";
    process.env.MONGODB_URI = "postgres://localhost/db";
    process.env.PORT = "not-a-number";
    process.env.NODE_ENV = "production";

    const { validateRequiredEnvVars } = require("../utils/envValidator");

    expect(() => validateRequiredEnvVars()).toThrow(/Cannot start in production with weak JWT_SECRET/);
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("warns on numeric env vars and production configuration gaps", () => {
    process.env.JWT_SECRET = "unit-test-jwt-secret-unit-test-jwt-secret";
    process.env.REFRESH_TOKEN_SECRET = "unit-test-refresh-secret-unit-test-refresh-secret";
    process.env.MONGODB_URI = "mongodb://localhost:27017/mydrive";
    process.env.PORT = "not-a-number";
    process.env.CHUNK_SIZE = "abc";
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "*";

    const { validateRequiredEnvVars } = require("../utils/envValidator");

    expect(() => validateRequiredEnvVars()).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Running production environment checks...");
  });
});