import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { createJWT } from "../../src/auth/jwt.js";
import type { Credentials } from "../../src/auth/config.js";

// Mock fs
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----"),
}));

// Mock jsonwebtoken
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("mock.jwt.token"),
  },
}));

const mockCreds: Credentials = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  serviceAccount: "test@service.account",
  privateKeyPath: "/path/to/key.key",
  botId: "test-bot-id",
};

describe("createJWT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a JWT with correct payload", async () => {
    const token = await createJWT(mockCreds);

    expect(token).toBe("mock.jwt.token");
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        iss: "test-client-id",
        sub: "test@service.account",
      }),
      expect.any(String),
      { algorithm: "RS256" }
    );
  });

  it("should set exp to iat + 3600", async () => {
    await createJWT(mockCreds);

    const call = vi.mocked(jwt.sign).mock.calls[0];
    const payload = call?.[0] as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(3600);
  });
});
