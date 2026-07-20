import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { clearCredentials, loadCredentials, loadToken, loadUserToken, saveUserToken } from "../../auth/config.js";
import { buildAuthorizeUrl, startOAuthCallbackServer, revokeToken } from "../../auth/oauth-user.js";
import { resolveScopes, mergeScopes } from "../../auth/scopes.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { generateSecureState } from "../../utils/sanitize.js";
import { defineTool } from "../tool-registry.js";

export function registerAuthTools(server: McpServer): void {
  // Tool 22: User OAuth 로그인
  defineTool(server,
    "nworks_login_user",
    "User OAuth 로그인을 시작합니다. 반환된 URL을 브라우저에서 열어 NAVER WORKS에 로그인하세요. 로그인 완료 후 자동으로 토큰이 저장됩니다. 중요: preset을 지정하지 마세요. 기본값(default=all)이 모든 API(캘린더, 메일, 할일, 드라이브, 게시판)를 포함하므로 한 번 로그인으로 전체 기능을 사용할 수 있습니다. 읽기 전용으로 제한하려면 preset='readonly'를 지정하세요(이 경우 생성/수정/삭제 도구는 재로그인 필요).",
    {
      preset: z
        .enum(["readonly", "default", "all"])
        .optional()
        .describe("scope 프리셋. 기본 default(=all, 전체 기능). readonly는 읽기 전용."),
      scope: z
        .string()
        .optional()
        .describe("고급: 공백 구분 raw scope 직접 지정(preset 대신). 특수한 경우에만 사용"),
    },
    async ({ preset, scope }) => {
      try {
        const creds = await loadCredentials();

        // 기존 토큰의 scope와 합쳐 재로그인 시 권한이 줄지 않게 한다.
        const existingToken = await loadUserToken();
        const existingScopes = existingToken?.scope?.split(" ").filter(Boolean) ?? [];
        const requestedScopes = resolveScopes(preset ?? scope);
        const mergedScopes = mergeScopes(existingScopes, requestedScopes);

        const state = generateSecureState();
        const authorizeUrl = buildAuthorizeUrl(creds.clientId, mergedScopes, state);

        // 콜백 서버를 백그라운드로 시작 (토큰 교환 및 저장까지 자동 처리)
        startOAuthCallbackServer(creds.clientId, creds.clientSecret, state)
          .then((token) =>
            saveUserToken({
              accessToken: token.accessToken,
              refreshToken: token.refreshToken,
              expiresAt: token.expiresAt,
              scope: token.scope,
            })
          )
          .then(() => {
            console.error("[nworks] User OAuth login successful. Token saved.");
          })
          .catch((err: Error) => {
            console.error(`[nworks] User OAuth login failed: ${err.message}`);
          });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message:
                  "아래 URL을 브라우저에서 열어 NAVER WORKS에 로그인하세요. 로그인 완료 후 자동으로 토큰이 저장됩니다. (제한시간: 120초)",
                loginUrl: authorizeUrl,
                scope: mergedScopes,
                callbackPort: 9876,
                timeout: "120초",
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

  // Tool 23: 인증 상태
  defineTool(server,
    "nworks_whoami",
    "현재 인증된 NAVER WORKS 계정 정보와 토큰 유효 상태를 확인합니다. 인증 문제 진단 시 먼저 호출",
    {},
    async () => {
      try {
        const creds = await loadCredentials();
        const token = await loadToken();
        const userToken = await loadUserToken();
        const isValid = token
          ? token.expiresAt > Date.now() / 1000
          : false;
        const userTokenValid = userToken
          ? userToken.expiresAt > Date.now() / 1000
          : false;

        const mask = (s: string) => s.length <= 4 ? "****" : `****${s.slice(-4)}`;
        const info = {
          serviceAccount: creds.serviceAccount ?? null,
          clientId: mask(creds.clientId),
          botId: creds.botId ?? null,
          tokenValid: isValid,
          userOAuth: userToken
            ? { valid: userTokenValid, scope: userToken.scope }
            : null,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(info) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 24: 로그아웃
  defineTool(server,
    "nworks_logout",
    "저장된 NAVER WORKS 인증 정보와 토큰을 모두 삭제합니다",
    {},
    async () => {
      try {
        try {
          const creds = await loadCredentials();
          const token = await loadToken();
          const userToken = await loadUserToken();
          if (token?.accessToken) {
            await revokeToken(token.accessToken, creds.clientId, creds.clientSecret);
          }
          if (userToken?.refreshToken) {
            await revokeToken(userToken.refreshToken, creds.clientId, creds.clientSecret);
          }
        } catch {
          // best-effort
        }
        await clearCredentials();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "인증 정보와 토큰이 모두 삭제되었습니다. 다시 사용하려면 nworks_setup tool로 재설정 후 nworks_login_user로 브라우저 로그인하세요.",
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
