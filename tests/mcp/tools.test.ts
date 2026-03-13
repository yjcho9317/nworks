import { describe, it, expect, vi, beforeEach } from "vitest";
import fixtures from "../fixtures/message-response.json";

// Mock message API
vi.mock("../../src/api/message.js", () => ({
  send: vi.fn(),
  listMembers: vi.fn(),
}));

// Mock auth config
vi.mock("../../src/auth/config.js", () => ({
  loadCredentials: vi.fn().mockResolvedValue({
    serviceAccount: "test@service.account",
    clientId: "test-client-id",
    botId: "test-bot-id",
  }),
  loadToken: vi.fn().mockResolvedValue({
    accessToken: "mock-token",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  }),
}));

import * as messageApi from "../../src/api/message.js";

describe("MCP tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("nworks_message_send", () => {
    it("should call messageApi.send and return JSON result", async () => {
      vi.mocked(messageApi.send).mockResolvedValue({
        success: true,
        messageId: "msg-abc123",
      });

      const result = await messageApi.send({
        to: "user-001",
        text: "Hello",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-abc123");
    });
  });

  describe("nworks_message_members", () => {
    it("should return member list", async () => {
      vi.mocked(messageApi.listMembers).mockResolvedValue(
        fixtures.members_list
      );

      const result = await messageApi.listMembers("ch-abc123");

      expect(result.members).toHaveLength(3);
    });
  });
});
