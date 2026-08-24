jest.mock("../models/Folder", () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/File", () => ({
  findOne: jest.fn(),
}));

const Folder = require("../models/Folder");
const File = require("../models/File");
const { checkLockStatus, hasLockedDescendants } = require("../utils/lockHelpers");

describe("lockHelpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("detects locks on the item itself and on ancestors", async () => {
    await expect(checkLockStatus({ isLocked: true, parent: null })).resolves.toEqual({
      isLocked: true,
      lockedItem: { isLocked: true, parent: null },
    });

    Folder.findById.mockResolvedValueOnce({ _id: "parent-1", isLocked: true, parent: null });
    await expect(checkLockStatus({ isLocked: false, parent: "parent-1" })).resolves.toEqual({
      isLocked: true,
      lockedItem: { _id: "parent-1", isLocked: true, parent: null },
    });

    Folder.findById.mockResolvedValueOnce({ _id: "parent-2", isLocked: false, parent: "root" });
    await expect(checkLockStatus({ isLocked: false, parent: { _id: "parent-2" } })).resolves.toEqual({
      isLocked: false,
      lockedItem: null,
    });

    await expect(checkLockStatus({ isLocked: false, parent: "root" })).resolves.toEqual({
      isLocked: false,
      lockedItem: null,
    });
  });

  it("recursively checks for locked descendants", async () => {
    File.findOne.mockResolvedValueOnce(null);
    Folder.find.mockResolvedValueOnce([{ _id: "sub-1", isLocked: false }]);
    File.findOne.mockResolvedValueOnce(null);
    Folder.find.mockResolvedValueOnce([{ _id: "sub-2", isLocked: true }]);

    await expect(hasLockedDescendants("root-folder")).resolves.toBe(true);
  });

  it("returns false when there are no locked descendants", async () => {
    File.findOne.mockResolvedValueOnce(null);
    Folder.find.mockResolvedValueOnce([]);

    await expect(hasLockedDescendants("empty-folder")).resolves.toBe(false);
  });

  it("returns false when a parent folder lookup stops the search", async () => {
    File.findOne.mockResolvedValueOnce(null);
    Folder.find.mockResolvedValueOnce([{ _id: "sub-3", isLocked: false }]);
    File.findOne.mockResolvedValueOnce(null);
    Folder.find.mockResolvedValueOnce([]);

    await expect(hasLockedDescendants("root-folder-2")).resolves.toBe(false);
  });
});