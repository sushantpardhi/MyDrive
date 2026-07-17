import {
  getFileType,
  getFileTypeCategory,
  getFileTypeIcon,
  getLanguage,
  parseSubtitles,
} from "./previewUtils";

describe("previewUtils", () => {
  it("classifies common file types", () => {
    expect(getFileType("photo.jpg")).toBe("image");
    expect(getFileType("report.pdf")).toBe("pdf");
    expect(getFileType("archive.zip")).toBe("archive");
    expect(getFileType("script.js")).toBe("text");
  });

  it("returns category metadata for representative files", () => {
    expect(getFileTypeCategory("slides.pptx")).toMatchObject({
      label: "PPTX",
      color: expect.any(String),
    });
    expect(getFileTypeCategory("notes.md")).toMatchObject({
      label: "Document",
      color: expect.any(String),
    });
  });

  it("maps icons and languages consistently", () => {
    expect(getFileTypeIcon("movie.mp4")).toBeDefined();
    expect(getLanguage("file.tsx")).toBe("tsx");
    expect(getLanguage("Dockerfile")).toBe("dockerfile");
  });

  it("parses SRT subtitles into cue objects", () => {
    const subtitles = parseSubtitles(
      "1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,500 --> 00:00:04,000\nWorld",
      "srt",
    );

    expect(subtitles).toEqual([
      { start: "00:00:00,000", end: "00:00:02,000", text: "Hello" },
      { start: "00:00:02,500", end: "00:00:04,000", text: "World" },
    ]);
  });
});