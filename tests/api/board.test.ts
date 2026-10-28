import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock user-client
const mockUserFetch = vi.fn();
vi.mock("../../src/api/user-client.js", () => ({
  userFetch: (...args: unknown[]) => mockUserFetch(...args),
  handleUserApiError: vi.fn(async (res: Response) => {
    throw new Error(`API error ${res.status}`);
  }),
}));

// Import after mocks
const { addPostAttachment } = await import("../../src/api/board.js");

const dir = mkdtempSync(join(tmpdir(), "nworks-board-"));
const photo = join(dir, "회의 사진.jpg");
writeFileSync(photo, Buffer.from("fake-jpeg-bytes"));

describe("board API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("addPostAttachment", () => {
    it("should request upload URL then upload multipart content", async () => {
      mockUserFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ uploadUrl: "https://apis-storage.worksmobile.com/k/up/abc" }), { status: 200 })
        )
        .mockResolvedValueOnce(new Response("", { status: 200 }));

      const result = await addPostAttachment("1000000000000000001", "1234", photo);

      expect(result).toEqual({ fileName: "회의 사진.jpg", fileSize: 15, contentType: "image/jpeg" });

      const [createUrl, createInit, profile] = mockUserFetch.mock.calls[0];
      expect(createUrl).toBe("https://www.worksapis.com/v1.0/boards/1000000000000000001/posts/1234/attachments");
      expect(JSON.parse(createInit.body)).toEqual({ fileName: "회의 사진.jpg", fileSize: 15, contentType: "image/jpeg" });
      expect(profile).toBe("default");

      const [uploadUrl, uploadInit] = mockUserFetch.mock.calls[1];
      expect(uploadUrl).toBe("https://apis-storage.worksmobile.com/k/up/abc");
      expect(uploadInit.headers["Content-Type"]).toMatch(/^multipart\/form-data; boundary=/);
      const sent = (uploadInit.body as Buffer).toString();
      expect(sent).toContain('name="Filedata"; filename="회의 사진.jpg"');
      expect(sent).toContain("Content-Type: image/jpeg");
      expect(sent).toContain("fake-jpeg-bytes");
    });

    it("should reject upload URL on untrusted host", async () => {
      mockUserFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadUrl: "https://evil.example.com/up" }), { status: 200 })
      );

      await expect(addPostAttachment("1", "2", photo)).rejects.toThrow(/untrusted host/);
      expect(mockUserFetch).toHaveBeenCalledTimes(1);
    });

    it("should surface API error when upload URL request fails", async () => {
      mockUserFetch.mockResolvedValueOnce(new Response("{}", { status: 403 }));

      await expect(addPostAttachment("1", "2", photo)).rejects.toThrow(/403/);
    });
  });
});
