const jwt = require("jsonwebtoken");

describe("authenticateToken middleware", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = "unit-test-jwt-secret-unit-test-jwt-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("reads a token from cookies and attaches the decoded user", () => {
    const { authenticateToken } = require("../middleware/auth");
    const token = jwt.sign({ id: "user-1", role: "user" }, process.env.JWT_SECRET);
    const req = { cookies: { accessToken: token }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: "user-1", role: "user" });
  });

  it("falls back to the authorization header when no cookie exists", () => {
    const { authenticateToken } = require("../middleware/auth");
    const token = jwt.sign({ id: "user-2", role: "admin" }, process.env.JWT_SECRET);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: "user-2", role: "admin" });
  });

  it("rejects requests without a token", () => {
    const { authenticateToken } = require("../middleware/auth");
    const req = { cookies: {}, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Access token required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests when auth config is missing or the token is invalid", () => {
    jest.resetModules();
    delete process.env.JWT_SECRET;

    const { authenticateToken } = require("../middleware/auth");

    const missingConfigRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    authenticateToken({ cookies: {}, headers: {} }, missingConfigRes, jest.fn());
    expect(missingConfigRes.status).toHaveBeenCalledWith(500);

    jest.resetModules();
    process.env.JWT_SECRET = "unit-test-jwt-secret-unit-test-jwt-secret";
    jest.spyOn(jwt, "verify").mockImplementationOnce((token, secret, callback) => {
      callback(new Error("bad token"));
    });

    const { authenticateToken: authenticateWithSecret } = require("../middleware/auth");
    const invalidRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    authenticateWithSecret(
      { cookies: { accessToken: "bad" }, headers: {} },
      invalidRes,
      jest.fn(),
    );

    expect(invalidRes.status).toHaveBeenCalledWith(403);
    jwt.verify.mockRestore();
  });
});