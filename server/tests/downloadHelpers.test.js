jest.mock("../utils/logger", () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../models/File", () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/Folder", () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

const File = require("../models/File");
const Folder = require("../models/Folder");
const DownloadHelpers = require("../utils/downloadHelpers");

describe("DownloadHelpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validates file access for owner and shared users", async () => {
    File.findById.mockResolvedValue({
      _id: "file-1",
      trash: false,
      owner: { toString: () => "user-1" },
      shared: [{ toString: () => "user-2" }],
    });

    await expect(DownloadHelpers.validateFileAccess("file-1", "user-1")).resolves.toMatchObject({ _id: "file-1" });
    await expect(DownloadHelpers.validateFileAccess("file-1", "user-2")).resolves.toMatchObject({ _id: "file-1" });
  });

  it("rejects trashed or unauthorized files", async () => {
    File.findById.mockResolvedValueOnce({
      _id: "file-trash",
      trash: true,
      owner: { toString: () => "user-1" },
    });
    File.findById.mockResolvedValueOnce({
      _id: "file-no-access",
      trash: false,
      owner: { toString: () => "user-1" },
      shared: [],
    });

    await expect(DownloadHelpers.validateFileAccess("file-trash", "user-1")).resolves.toBeNull();
    await expect(DownloadHelpers.validateFileAccess("file-no-access", "user-2")).resolves.toBeNull();
  });

  it("resolves folder contents recursively and deduplicates files", async () => {
    Folder.findById.mockImplementation(async (folderId) => {
      if (folderId === "root-folder") {
        return {
          _id: "root-folder",
          trash: false,
          owner: { toString: () => "user-1" },
          shared: [],
          name: "Root",
        };
      }
      if (folderId === "child-folder") {
        return {
          _id: "child-folder",
          trash: false,
          owner: { toString: () => "user-1" },
          shared: [],
          name: "Child",
        };
      }
      return null;
    });

    File.find.mockImplementation(async (query) => {
      if (query.parent === "root-folder") {
        return [
          { _id: "file-1", name: "alpha.txt", path: "/tmp/alpha.txt", size: 10 },
        ];
      }
      if (query.parent === "child-folder") {
        return [
          { _id: "file-2", name: "beta.txt", path: "/tmp/beta.txt", size: 20 },
          { _id: "file-1", name: "alpha.txt", path: "/tmp/alpha.txt", size: 10 },
        ];
      }
      return [];
    });

    Folder.find.mockImplementation(async (query) => {
      if (query.parent === "root-folder") {
        return [{ _id: "child-folder", name: "Child" }];
      }
      return [];
    });

    File.findById.mockImplementation(async (fileId) => {
      const files = {
        "file-1": { _id: "file-1", trash: false, owner: { toString: () => "user-1" }, shared: [] },
        "file-2": { _id: "file-2", trash: false, owner: { toString: () => "user-1" }, shared: [] },
      };
      return files[fileId] || null;
    });

    const selection = await DownloadHelpers.resolveDownloadSelection(["file-1"], ["root-folder"], "user-1");

    expect(selection.totalFiles).toBe(2);
    expect(selection.files).toHaveLength(2);
    expect(selection.folderNames).toEqual(["Root"]);
    expect(DownloadHelpers.generateZipFilename(["file-1"], [], [])).toMatch(/^file-/);
    expect(DownloadHelpers.generateZipFilename([], ["root-folder"], ["My Folder"])).toBe("My Folder.zip");
    expect(DownloadHelpers.checkSizeLimit(10, 0)).toBe(true);
    expect(DownloadHelpers.formatSize(2048)).toBe("2.00 KB");
  });

  it("handles access failures and selection errors", async () => {
    File.findById.mockRejectedValueOnce(new Error("file boom"));
    await expect(DownloadHelpers.validateFileAccess("file-error", "user-1")).resolves.toBeNull();

    Folder.findById.mockResolvedValueOnce(null);
    await expect(DownloadHelpers.validateFolderAccess("folder-missing", "user-1")).resolves.toBeNull();

    File.findById.mockResolvedValueOnce({
      _id: "file-3",
      trash: false,
      owner: { toString: () => "user-2" },
      shared: [],
    });
    Folder.findById.mockResolvedValueOnce({
      _id: "folder-3",
      trash: false,
      owner: { toString: () => "user-1" },
      shared: [],
      name: "Folder 3",
    });
    File.find.mockRejectedValueOnce(new Error("list failed"));

    const selection = await DownloadHelpers.resolveDownloadSelection(["file-3"], ["folder-3"], "user-1");
    expect(selection.errors.length).toBeGreaterThan(0);
    expect(DownloadHelpers.checkSizeLimit(10, -1)).toBe(true);
    expect(DownloadHelpers.generateZipFilename([], ["folder-3"], ["Folder 3"])).toBe("Folder 3.zip");
  });

  it("covers folder access failures and root-level helpers", async () => {
    Folder.findById.mockResolvedValueOnce(null);
    await expect(DownloadHelpers.validateFolderAccess("missing-folder", "user-1")).resolves.toBeNull();

    Folder.findById.mockResolvedValueOnce({
      _id: "folder-trash",
      trash: true,
      owner: { toString: () => "user-1" },
      shared: [],
    });
    await expect(DownloadHelpers.validateFolderAccess("folder-trash", "user-1")).resolves.toBeNull();

    expect(DownloadHelpers.generateZipFilename(["f1", "f2"], [], [])).toMatch(/^MyDrive-2-items-/);
    expect(DownloadHelpers.formatSize(1024 * 1024 * 2)).toBe("2.00 MB");
  });
});