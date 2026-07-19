import { describe, it, expect, vi } from "vitest";

// 실제 사용자 설정(~/.config/nworks)을 절대 건드리지 않도록 fs를 목으로 대체한다.
vi.mock("node:fs", () => ({ existsSync: () => false }));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => "{}"),
  writeFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  chmod: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
}));

import { saveToken, loadToken, saveCredentials } from "../../src/auth/config.js";

describe("profile name validation", () => {
  const dangerous = ["__proto__", "constructor", "prototype", "a/b", "a\\b", ".", "..", "..."];

  for (const name of dangerous) {
    it(`rejects dangerous/invalid profile name ${JSON.stringify(name)}`, async () => {
      await expect(saveToken({ accessToken: "x", expiresAt: 0 }, name)).rejects.toThrow();
      await expect(loadToken(name)).rejects.toThrow();
      await expect(
        saveCredentials({ clientId: "x", clientSecret: "y" }, name)
      ).rejects.toThrow();
    });
  }

  it("rejects the empty profile name", async () => {
    await expect(loadToken("")).rejects.toThrow();
  });

  it("accepts a normal profile name (no throw from validation)", async () => {
    // fs가 목이므로 실제 파일은 만들어지지 않는다. 정상 이름이 거부되지 않는지 확인.
    await expect(saveToken({ accessToken: "x", expiresAt: 0 }, "work-2")).resolves.toBeUndefined();
    await expect(loadToken("work-2")).resolves.toBeNull();
  });
});
