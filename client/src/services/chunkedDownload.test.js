import { ChunkedDownloadService } from "./chunkedDownload";

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  logError: jest.fn(),
}));

describe("ChunkedDownloadService", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalShowSaveFilePicker = window.showSaveFilePicker;
  let clickSpy;

  beforeEach(() => {
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    URL.createObjectURL = jest.fn(() => "blob:test");
    URL.revokeObjectURL = jest.fn();
    delete window.showSaveFilePicker;
  });

  afterEach(() => {
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;

    if (originalShowSaveFilePicker) {
      window.showSaveFilePicker = originalShowSaveFilePicker;
    } else {
      delete window.showSaveFilePicker;
    }
  });

  const createApi = () => ({
    initiateChunkedDownload: jest.fn().mockResolvedValue({
      data: {
        session: {
          downloadId: "download-1",
          fileName: "large.bin",
          fileSize: 6,
          totalChunks: 2,
          chunkSize: 3,
        },
      },
    }),
    downloadChunk: jest
      .fn()
      .mockImplementation((downloadId, chunkIndex) =>
        Promise.resolve({
          data:
            chunkIndex === 0
              ? new Uint8Array([1, 2, 3]).buffer
              : new Uint8Array([4, 5, 6]).buffer,
        }),
      ),
    pauseChunkedDownload: jest.fn().mockResolvedValue({}),
    resumeChunkedDownload: jest.fn().mockResolvedValue({ data: { missingChunks: [] } }),
    cancelChunkedDownload: jest.fn().mockResolvedValue({}),
  });

  it("falls back to blob assembly when the File System Access API is unavailable", async () => {
    const api = createApi();
    const service = new ChunkedDownloadService(api);

    const result = await service.downloadFile("file-1", "large.bin", "client-1");

    expect(result.success).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("streams chunks directly to a writable file when the File System Access API is available", async () => {
    const writable = {
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      truncate: jest.fn().mockResolvedValue(undefined),
      abort: jest.fn().mockResolvedValue(undefined),
    };
    const fileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };
    window.showSaveFilePicker = jest.fn().mockResolvedValue(fileHandle);

    const api = createApi();
    const service = new ChunkedDownloadService(api);

    const result = await service.downloadFile("file-1", "large.bin", "client-1");

    expect(result.success).toBe(true);
    expect(window.showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "large.bin",
    });
    expect(writable.truncate).toHaveBeenCalledWith(6);
    expect(writable.write).toHaveBeenCalledTimes(2);
    expect(writable.write).toHaveBeenNthCalledWith(1, {
      type: "write",
      position: 0,
      data: expect.any(Uint8Array),
    });
    expect(writable.write).toHaveBeenNthCalledWith(2, {
      type: "write",
      position: 3,
      data: expect.any(Uint8Array),
    });
    expect(writable.close).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });
});