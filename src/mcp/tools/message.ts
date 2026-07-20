import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as messageApi from "../../api/message.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerMessageTools(server: McpServer): void {
  // Tool 1: 메시지 전송
  defineTool(server,
    "nworks_message_send",
    "NAVER WORKS 메시지를 전송합니다 (봇이 사용자 또는 채널에 발송). Service Account 인증 사용 (nworks_setup에서 serviceAccount, botId 설정 + 환경변수 NWORKS_PRIVATE_KEY_PATH 필요. User OAuth 불필요)",
    {
      to: z.string().optional().describe("수신자 userId (channel과 택 1). nworks_directory_members로 userId 조회 가능"),
      channel: z.string().optional().describe("채널 channelId (to와 택 1). nworks_message_members로 채널 구성원 확인 가능"),
      text: z.string().describe("메시지 본문"),
      type: z
        .enum(["text", "button", "list"])
        .optional()
        .describe("메시지 타입 (기본: text)"),
      actions: z
        .string()
        .optional()
        .describe("버튼 액션 JSON (type=button일 때)"),
      elements: z
        .string()
        .optional()
        .describe("리스트 항목 JSON (type=list일 때)"),
    },
    async ({ to, channel, text, type, actions, elements }) => {
      try {
        const result = await messageApi.send({
          to,
          channel,
          text,
          type,
          actions,
          elements,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: 채널 구성원
  defineTool(server,
    "nworks_message_members",
    "특정 채널의 구성원 목록을 조회합니다. '이 채널에 누가 있어?' 등의 요청에 사용. Service Account 인증 사용 (nworks_setup 필요)",
    {
      channel: z.string().describe("채널 channelId"),
    },
    async ({ channel }) => {
      try {
        const result = await messageApi.listMembers(channel);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );
}
