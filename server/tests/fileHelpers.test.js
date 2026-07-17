const fs = require("fs");

describe("fileHelpers", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.UPLOAD_DIR;
  });

  it("resolves relative upload directories against cwd", () => {
    jest.spyOn(process, "cwd").mockReturnValue("/workspace");
    process.env.UPLOAD_DIR = "uploads";

    const { getUserUploadDir } = require("../utils/fileHelpers");

    expect(getUserUploadDir("user-1")).toBe("/workspace/uploads/user-1");
  });

  it("preserves absolute upload directories", () => {
    process.env.UPLOAD_DIR = "/var/data/uploads";

    const { getUserUploadDir } = require("../utils/fileHelpers");

    expect(getUserUploadDir("user-1")).toBe("/var/data/uploads/user-1");
  });

  it("creates the user directory when it does not exist", () => {
    jest.spyOn(process, "cwd").mockReturnValue("/workspace");
    process.env.UPLOAD_DIR = "uploads";
    jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSync = jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});

    const { ensureUserDir } = require("../utils/fileHelpers");
    const userDir = ensureUserDir("user-1");

    expect(userDir).toBe("/workspace/uploads/user-1");
    expect(mkdirSync).toHaveBeenCalledWith("/workspace/uploads/user-1", {
      recursive: true,
    });
  });

  it("uses the default uploads directory and skips mkdir when present", () => {
    jest.spyOn(process, "cwd").mockReturnValue("/workspace");
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const mkdirSync = jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});

    const { getBaseDir, getUserFilePath, ensureUserDir } = require("../utils/fileHelpers");

    expect(getBaseDir()).toBe("/workspace/uploads");
    expect(getUserFilePath("user-1", "file.txt")).toBe("/workspace/uploads/user-1/file.txt");
    expect(ensureUserDir("user-1")).toBe("/workspace/uploads/user-1");
    expect(mkdirSync).not.toHaveBeenCalled();
  });
});