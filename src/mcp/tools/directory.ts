import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as directoryApi from "../../api/directory.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerDirectoryTools(server: McpServer): void {
  // Tool 3: 조직 구성원 목록
  defineTool(server,
    "nworks_directory_members",
    "NAVER WORKS 조직 구성원(직원) 목록을 조회합니다. '구성원 목록 보여줘', '팀원 찾아줘', '누구한테 메시지 보낼지 userId 찾기' 등에 사용. Service Account 인증 사용 (nworks_setup 필요). 메시지 전송 시 수신자 userId를 여기서 조회 가능. 구성원이 많으면 nextCursor로 다음 페이지를 이어서 조회",
    {
      count: z.number().int().min(1).optional().describe("페이지당 항목 수 (기본: 100)"),
      cursor: z.string().optional().describe("페이지네이션 커서 (이전 응답의 nextCursor 값)"),
    },
    async ({ count, cursor }) => {
      try {
        const result = await directoryApi.listUsers(count ?? 100, cursor);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            users: result.users,
            count: result.users.length,
            hasMore: !!result.responseMetaData?.nextCursor,
            nextCursor: result.responseMetaData?.nextCursor ?? null,
          }) }],
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
