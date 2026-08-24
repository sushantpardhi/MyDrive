let GuestSession;

jest.mock("mongoose", () => {
  class MockSchema {
    constructor() {
      this.statics = {};
    }
    pre() {}
    index() {}
  }

  MockSchema.Types = { ObjectId: class ObjectId {} };

  return {
    Schema: MockSchema,
    model: jest.fn((name, schema) => {
      function MockModel(doc) {
        Object.assign(this, doc);
      }

      MockModel.prototype.save = jest.fn().mockResolvedValue(undefined);
      Object.assign(MockModel, schema.statics);
      return MockModel;
    }),
  };
});

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("GuestSession createSession", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.GUEST_SESSION_DURATION = "86400000";
    GuestSession = require("../models/GuestSession");
  });

  afterEach(() => {
    delete process.env.GUEST_SESSION_DURATION;
  });

  it("creates a new guest session", async () => {
    const session = await GuestSession.createSession("guest-user-1");

    expect(session.userId).toBe("guest-user-1");
    expect(session.status).toBe("active");
    expect(session.extensionCount).toBe(0);
    expect(session.expiresAt).toBeInstanceOf(Date);
  });
});