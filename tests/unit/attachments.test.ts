import { describe, expect, it } from "vitest";

import { MAX_ATTACHMENT_BYTES, formatBytes, safeStorageName } from "@/lib/attachments";

describe("safeStorageName", () => {
  it("strips directory traversal", () => {
    expect(safeStorageName("../../etc/passwd")).toBe("passwd");
    expect(safeStorageName("..\\..\\windows\\system32\\config")).toBe("config");
  });

  it("keeps reasonable characters", () => {
    expect(safeStorageName("report-2026_final.pdf")).toBe("report-2026_final.pdf");
  });

  it("replaces spaces and unsafe characters", () => {
    expect(safeStorageName("my report (final).pdf")).toBe("my_report_final_.pdf");
  });

  it("never returns an empty name", () => {
    expect(safeStorageName("")).toBe("file");
    expect(safeStorageName("...")).toBe("file");
  });

  it("caps the length", () => {
    expect(safeStorageName("a".repeat(200)).length).toBe(80);
  });
});

describe("formatBytes", () => {
  it("formats bytes, kilobytes and megabytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("tolerates invalid input", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("MAX_ATTACHMENT_BYTES", () => {
  it("is ten megabytes", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
