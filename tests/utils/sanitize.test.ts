import { describe, it, expect } from "vitest";
import {
  sanitizePathSegment,
  sanitizeFileName,
  validateLocalPath,
  validateRedirectUrl,
  generateSecureState,
} from "../../src/utils/sanitize.js";

describe("sanitizePathSegment", () => {
  it("allows normal alphanumeric IDs", () => {
    expect(sanitizePathSegment("abc123")).toBe("abc123");
  });

  it("allows 'me'", () => {
    expect(sanitizePathSegment("me")).toBe("me");
  });

  it("encodes special characters", () => {
    expect(sanitizePathSegment("user@domain")).toBe("user%40domain");
  });

  it("rejects paths with slashes", () => {
    expect(() => sanitizePathSegment("../admin")).toThrow("Invalid path segment");
    expect(() => sanitizePathSegment("a/b")).toThrow("Invalid path segment");
    expect(() => sanitizePathSegment("a\\b")).toThrow("Invalid path segment");
  });

  it("rejects paths with ..", () => {
    expect(() => sanitizePathSegment("..")).toThrow("Invalid path segment");
    expect(() => sanitizePathSegment("foo/../bar")).toThrow("Invalid path segment");
  });

  it("rejects empty string", () => {
    expect(() => sanitizePathSegment("")).toThrow("non-empty string");
  });
});

describe("sanitizeFileName", () => {
  it("allows normal file names", () => {
    expect(sanitizeFileName("document.pdf")).toBe("document.pdf");
  });

  it("strips path components", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("/etc/shadow")).toBe("shadow");
  });

  it("replaces CRLF characters", () => {
    expect(sanitizeFileName("file\r\nname.txt")).toBe("file__name.txt");
  });

  it("replaces quotes", () => {
    expect(sanitizeFileName('file"name.txt')).toBe("file_name.txt");
  });

  it("strips backslash path components on all platforms", () => {
    expect(sanitizeFileName("dir\\name.txt")).toBe("name.txt");
    expect(sanitizeFileName("a\\b\\c.txt")).toBe("c.txt");
  });

  it("rejects empty string", () => {
    expect(() => sanitizeFileName("")).toThrow("non-empty string");
  });
});

describe("validateLocalPath", () => {
  it("resolves a normal path", () => {
    const result = validateLocalPath("./test.txt");
    expect(result).toContain("test.txt");
    expect(result).not.toContain("..");
  });

  it("rejects path escaping allowedBase", () => {
    expect(() =>
      validateLocalPath("../../etc/passwd", "/home/user/uploads")
    ).toThrow("escapes the allowed directory");
  });

  it("allows path within allowedBase", () => {
    const base = process.cwd();
    const result = validateLocalPath("./test.txt", base);
    expect(result.startsWith(base)).toBe(true);
  });
});

describe("validateRedirectUrl", () => {
  const hosts = ["storage.worksmobile.com", "www.worksapis.com"];

  it("allows URLs to whitelisted hosts", () => {
    expect(
      validateRedirectUrl("https://storage.worksmobile.com/download/file", hosts)
    ).toBe("https://storage.worksmobile.com/download/file");
  });

  it("allows subdomains of whitelisted hosts", () => {
    expect(
      validateRedirectUrl("https://cdn.storage.worksmobile.com/file", hosts)
    ).toBe("https://cdn.storage.worksmobile.com/file");
  });

  it("rejects non-HTTPS URLs", () => {
    expect(() =>
      validateRedirectUrl("http://storage.worksmobile.com/file", hosts)
    ).toThrow("must use HTTPS");
  });

  it("rejects untrusted hosts", () => {
    expect(() =>
      validateRedirectUrl("https://evil.com/steal", hosts)
    ).toThrow("untrusted host");
  });

  it("rejects invalid URLs", () => {
    expect(() => validateRedirectUrl("not-a-url", hosts)).toThrow("Invalid redirect URL");
  });
});

describe("generateSecureState", () => {
  it("returns a 64-character hex string", () => {
    const state = generateSecureState();
    expect(state).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(state)).toBe(true);
  });

  it("generates unique values", () => {
    const a = generateSecureState();
    const b = generateSecureState();
    expect(a).not.toBe(b);
  });
});
