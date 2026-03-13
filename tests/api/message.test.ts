import { describe, it, expect, vi, beforeEach } from "vitest";
import fixtures from "../fixtures/message-response.json";

// Mock the client module
const mockRequest = vi.fn();
vi.mock("../../src/api/client.js", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

// Mock auth/config
vi.mock("../../src/auth/config.js", () => ({
  loadCredentials: vi.fn().mockResolvedValue({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    serviceAccount: "test@service.account",
    privateKeyPath: "/path/to/key.key",
    botId: "test-bot-id",
  }),
}));

// Import after mocks
const { send, listMembers } = await import("../../src/api/message.js");

describe("message API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("send", () => {
    it("should send text message to user", async () => {
      mockRequest.mockResolvedValue(fixtures.send_text_success);

      const result = await send({ to: "user-001", text: "Hello" });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-abc123");
      expect(mockRequest).toHaveBeenCalledWith({
        method: "POST",
        path: "/bots/test-bot-id/users/user-001/messages",
        body: { content: { type: "text", text: "Hello" } },
        profile: "default",
      });
    });

    it("should send text message to channel", async () => {
      mockRequest.mockResolvedValue(fixtures.send_text_success);

      const result = await send({ channel: "ch-abc123", text: "Hello team" });

      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/bots/test-bot-id/channels/ch-abc123/messages",
        })
      );
    });

    it("should send button message", async () => {
      mockRequest.mockResolvedValue(fixtures.send_text_success);

      await send({
        to: "user-001",
        text: "PR Review",
        type: "button",
        actions:
          '[{"type":"message","label":"Approve","postback":"approve"}]',
      });

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            content: {
              type: "button_template",
              contentText: "PR Review",
              actions: [
                { type: "message", label: "Approve", postback: "approve" },
              ],
            },
          },
        })
      );
    });

    it("should send list message", async () => {
      mockRequest.mockResolvedValue(fixtures.send_text_success);

      await send({
        to: "user-001",
        text: "Todo list",
        type: "list",
        elements: '[{"title":"Task 1","subtitle":"Description 1"}]',
      });

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            content: {
              type: "list_template",
              coverData: { text: "Todo list" },
              elements: [{ title: "Task 1", subtitle: "Description 1" }],
            },
          },
        })
      );
    });

    it("should throw error when neither to nor channel provided", async () => {
      await expect(send({ text: "Hello" })).rejects.toThrow(
        "Either --to (userId) or --channel (channelId) is required."
      );
    });
  });

  describe("listMembers", () => {
    it("should return member list for channel", async () => {
      mockRequest.mockResolvedValue(fixtures.members_list);

      const result = await listMembers("ch-abc123");

      expect(result.members).toHaveLength(3);
      expect(result.members[0]).toBe("user-001");
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/bots/test-bot-id/channels/ch-abc123/members",
        })
      );
    });
  });
});
