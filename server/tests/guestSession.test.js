describe("GuestSession configuration", () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.GUEST_SESSION_DURATION;
    delete process.env.GUEST_SESSION_EXTENSION;
    delete process.env.GUEST_MAX_EXTENSIONS;
    delete process.env.GUEST_STORAGE_LIMIT;
  });

  it("falls back to safe defaults when guest env vars are missing", () => {
    const GuestSession = require("../models/GuestSession");

    expect(GuestSession.GUEST_SESSION_DURATION).toBe(24 * 60 * 60 * 1000);
    expect(GuestSession.GUEST_SESSION_EXTENSION).toBe(30 * 60 * 1000);
    expect(GuestSession.GUEST_MAX_EXTENSIONS).toBe(3);
    expect(GuestSession.GUEST_STORAGE_LIMIT).toBe(500 * 1024 * 1024);
  });

  it("covers guest session static methods", async () => {
    const GuestSession = require("../models/GuestSession");

    GuestSession.findById = jest.fn();
    GuestSession.find = jest.fn();
    GuestSession.updateMany = jest.fn();

    const expiredSession = {
      _id: "session-2",
      status: "expired",
      expiresAt: new Date(Date.now() - 1000),
      extensionCount: 3,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    GuestSession.findById.mockResolvedValueOnce(null);
    await expect(GuestSession.isSessionValid("missing")).resolves.toBe(false);

    const activeSession = {
      _id: "session-1",
      status: "active",
      expiresAt: new Date(Date.now() + 1000),
      extensionCount: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    GuestSession.findById.mockResolvedValueOnce(activeSession);
    await expect(GuestSession.isSessionValid("session-1")).resolves.toBe(true);

    GuestSession.findById.mockResolvedValueOnce(activeSession);
    await expect(GuestSession.getSessionStatus("session-1")).resolves.toMatchObject({
      sessionId: "session-1",
      status: "active",
      canExtend: true,
      isExpired: false,
    });

    GuestSession.findById.mockResolvedValueOnce(expiredSession);
    await expect(GuestSession.getSessionStatus("session-2")).resolves.toMatchObject({
      status: "expired",
      canExtend: false,
      isExpired: true,
    });

    GuestSession.findById.mockResolvedValueOnce(null);
    await expect(GuestSession.getSessionStatus("missing-session")).resolves.toBeNull();

    GuestSession.find.mockResolvedValueOnce([expiredSession]);
    await expect(GuestSession.findExpiredSessions()).resolves.toEqual([expiredSession]);

    GuestSession.updateMany.mockResolvedValueOnce({ modifiedCount: 2 });
    await expect(GuestSession.markExpiredSessions()).resolves.toEqual({
      modifiedCount: 2,
    });

    GuestSession.updateMany.mockResolvedValueOnce({ modifiedCount: 0 });
    await expect(GuestSession.markExpiredSessions()).resolves.toEqual({
      modifiedCount: 0,
    });
  });

  it("covers extend and convert session failure branches", async () => {
    const GuestSession = require("../models/GuestSession");

    GuestSession.findById = jest.fn();
    GuestSession.findByIdAndUpdate = jest.fn();

    GuestSession.findById.mockResolvedValueOnce(null);
    await expect(GuestSession.extendSession("missing")).resolves.toBeNull();

    GuestSession.findById.mockResolvedValueOnce({
      _id: "session-3",
      status: "expired",
      extensionCount: 0,
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(GuestSession.extendSession("session-3")).resolves.toBeNull();

    GuestSession.findById.mockResolvedValueOnce({
      _id: "session-4",
      status: "active",
      extensionCount: 3,
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(GuestSession.extendSession("session-4")).resolves.toBeNull();

    GuestSession.findByIdAndUpdate.mockResolvedValueOnce(null);
    await expect(GuestSession.convertSession("missing")).resolves.toBeNull();
  });

  it("covers successful convertSession and expired-session lookup", async () => {
    const GuestSession = require("../models/GuestSession");

    GuestSession.findByIdAndUpdate = jest.fn().mockResolvedValueOnce({
      _id: "session-5",
      userId: "user-5",
      status: "converted",
    });
    GuestSession.find = jest.fn().mockResolvedValueOnce([
      { _id: "session-6", status: "active", expiresAt: new Date(Date.now() - 1000) },
    ]);

    await expect(GuestSession.convertSession("session-5")).resolves.toMatchObject({
      status: "converted",
    });
    await expect(GuestSession.findExpiredSessions()).resolves.toHaveLength(1);
  });

  it("covers successful extendSession", async () => {
    const GuestSession = require("../models/GuestSession");

    const session = {
      _id: "session-7",
      status: "active",
      extensionCount: 0,
      expiresAt: new Date(Date.now() + 1000),
      save: jest.fn().mockResolvedValue(undefined),
    };

    GuestSession.findById = jest.fn().mockResolvedValueOnce(session);

    await expect(GuestSession.extendSession("session-7")).resolves.toMatchObject({
      _id: "session-7",
      status: "active",
      extensionCount: 1,
    });
    expect(session.save).toHaveBeenCalledTimes(1);
  });
});