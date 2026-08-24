let capturedSaveHook;

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
}));

jest.mock("mongoose", () => {
  class MockSchema {
    constructor(definition) {
      this.definition = definition;
    }

    pre(event, handler) {
      if (event === "save") {
        capturedSaveHook = handler;
      }
    }
  }

  MockSchema.Types = { ObjectId: class ObjectId {} };

  return {
    Schema: MockSchema,
    model: jest.fn(() => ({})),
  };
});

describe("User model", () => {
  beforeEach(() => {
    capturedSaveHook = undefined;
    jest.resetModules();
  });

  it("sets storage limits from the selected role in the pre-save hook", () => {
    require("../models/User");

    const adminDoc = {
      _id: "user-1",
      role: "admin",
      isNew: true,
      isModified: jest.fn(),
      storageLimit: 123,
    };

    const userDoc = {
      _id: "user-2",
      role: "user",
      isNew: false,
      isModified: jest.fn((field) => field === "role"),
      storageLimit: 123,
    };

    const next = jest.fn();

    capturedSaveHook.call(adminDoc, next);
    capturedSaveHook.call(userDoc, next);

    expect(adminDoc.storageLimit).toBe(-1);
    expect(userDoc.storageLimit).toBe(5 * 1024 * 1024 * 1024);
    expect(next).toHaveBeenCalledTimes(2);
  });
});