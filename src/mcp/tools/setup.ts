import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveCredentials } from "../../auth/config.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerSetupTools(server: McpServer): void {
  // Tool 0: 초기 설정
  defineTool(server,
    "nworks_setup",
    `NAVER WORKS API 인증 정보를 설정합니다.

■ 사전 준비 (사용자가 직접 해야 함):
  1. https://dev.worksmobile.com 에서 앱 생성 후 Client ID와 Client Secret을 발급받습니다.
  2. MCP 설정 파일(예: claude_desktop_config.json)의 nworks 서버에 env 필드를 추가합니다:
     { "env": { "NWORKS_CLIENT_SECRET": "<발급받은 Client Secret>" } }
  3. MCP 클라이언트(예: Claude Desktop)를 재시작합니다.

■ 이 tool의 역할:
  - clientId(필수)와 serviceAccount, botId, domainId(선택)를 파라미터로 받아 저장합니다.
  - Client Secret은 보안을 위해 파라미터로 받지 않으며, 환경변수 NWORKS_CLIENT_SECRET에서 자동으로 읽습니다.
  - Service Account 사용 시 환경변수 NWORKS_PRIVATE_KEY_PATH도 필요합니다.

■ 설정 후 다음 단계:
  - 캘린더/메일/드라이브/할일/게시판 → nworks_login_user tool로 브라우저 로그인 필요
  - 메시지/구성원조회 → Service Account 인증 (serviceAccount + botId + NWORKS_PRIVATE_KEY_PATH)

■ 환경변수 NWORKS_CLIENT_SECRET이 없으면 이 tool은 실패합니다. 실패 시 사용자에게 위 사전 준비 단계를 안내하세요.

OAuth Redirect URI: http://localhost:9876/callback`,
    {
      clientId: z.string().describe("Client ID (Developer Console에서 발급)"),
      serviceAccount: z.string().optional().describe("Service Account ID (예: xxxxx.serviceaccount@domain)"),
      botId: z.string().optional().describe("Bot ID (메시지 전송 시 필요)"),
      domainId: z.string().optional().describe("Domain ID"),
    },
    async ({ clientId, serviceAccount, botId, domainId }) => {
      try {
        const resolvedSecret = process.env["NWORKS_CLIENT_SECRET"];
        if (!resolvedSecret) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
                  error: true,
                  message: "환경변수 NWORKS_CLIENT_SECRET이 설정되어 있지 않습니다.",
                  userAction: [
                    "1. https://dev.worksmobile.com 에서 앱의 Client Secret을 확인합니다.",
                    '2. MCP 설정 파일(예: claude_desktop_config.json)을 열고, nworks 서버 설정에 다음을 추가합니다:',
                    '   "env": { "NWORKS_CLIENT_SECRET": "<Client Secret>" }',
                    "3. MCP 클라이언트(예: Claude Desktop)를 재시작합니다.",
                    "4. 재시작 후 다시 시도해주세요.",
                  ],
                  configExample: '{ "mcpServers": { "nworks": { "command": "npx", "args": ["-y", "nworks", "mcp"], "env": { "NWORKS_CLIENT_SECRET": "<Client Secret>" } } } }',
                }) }],
            isError: true,
          };
        }

        const resolvedPrivateKeyPath = process.env["NWORKS_PRIVATE_KEY_PATH"];

        await saveCredentials({
          clientId,
          clientSecret: resolvedSecret,
          serviceAccount,
          privateKeyPath: resolvedPrivateKeyPath,
          botId,
          domainId,
        });

        const nextSteps: string[] = [];
        if (serviceAccount && resolvedPrivateKeyPath && botId) {
          nextSteps.push("Service Account 인증 준비 완료 — 봇 메시지 등 바로 사용 가능");
        } else if (serviceAccount && botId && !resolvedPrivateKeyPath) {
          nextSteps.push("NWORKS_PRIVATE_KEY_PATH 환경변수가 설정되지 않았습니다. Service Account 인증에는 Private Key 파일 경로가 필요합니다. 사용자에게 안내하세요: (1) Developer Console(https://dev.worksmobile.com)에서 Private Key를 다운로드 (2) MCP 설정 파일의 env에 NWORKS_PRIVATE_KEY_PATH를 추가 (예: \"NWORKS_PRIVATE_KEY_PATH\": \"C:/keys/private.key\") (3) MCP 클라이언트 재시작");
        }
        nextSteps.push("User OAuth가 필요한 API는 nworks_login_user tool로 브라우저 로그인을 진행하세요");

        const mask = (s: string) => s.length <= 4 ? "****" : `****${s.slice(-Math.min(4, Math.floor(s.length / 3)))}`;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "인증 정보가 저장되었습니다.",
                nextSteps,
                clientId: mask(clientId),
                clientSecret: `${mask(resolvedSecret)} (환경변수)`,
                serviceAccount: serviceAccount ?? null,
                privateKeyPath: resolvedPrivateKeyPath ? `${mask(resolvedPrivateKeyPath)} (환경변수)` : null,
                botId: botId ?? null,
              }),
            },
          ],
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
