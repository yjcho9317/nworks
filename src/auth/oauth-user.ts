import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { AuthError } from "../utils/error.js";
import { loadCredentials } from "./config.js";

const AUTH_URL = "https://auth.worksmobile.com/oauth2/v2.0/authorize";
const TOKEN_URL = "https://auth.worksmobile.com/oauth2/v2.0/token";
const REDIRECT_PORT = 9876;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

interface UserTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export function buildAuthorizeUrl(clientId: string, scope: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope,
    response_type: "code",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function startUserOAuthFlow(
  _scope: string,
  profile: string,
  expectedState: string
): Promise<UserTokenResult> {
  const creds = await loadCredentials(profile);
  const code = await waitForAuthCode(expectedState);

  return exchangeCodeForToken(code, creds.clientId, creds.clientSecret);
}

function waitForAuthCode(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new AuthError("OAuth login timed out (120s). Try again."));
    }, 120_000);

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");

      if (state !== expectedState) {
        // state가 맞지 않는 요청(오배송·프리페치·탐색 시도)은 거부하되 서버는 계속 리스닝한다.
        // 한 번의 잘못된 요청으로 로그인 세션 전체를 종료시키지 않기 위함(로컬 DoS 방지).
        // 정당한 콜백이 오거나 타임아웃될 때까지 대기한다.
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>보안 오류</h2><p>state 불일치. 브라우저에서 로그인을 다시 진행하세요.</p>");
        return;
      }

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>로그인 실패</h2><p>이 창을 닫아도 됩니다.</p>");
        clearTimeout(timeout);
        server.close();
        reject(new AuthError(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>잘못된 요청</h2><p>Authorization code가 없습니다.</p>");
        clearTimeout(timeout);
        server.close();
        reject(new AuthError("Missing authorization code in callback."));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h2>로그인 성공!</h2><p>이 창을 닫고 터미널로 돌아가세요.</p>");
      clearTimeout(timeout);
      server.close();
      resolve(code);
    });

    server.listen(REDIRECT_PORT, "127.0.0.1", () => {
      // Server ready — caller opens browser
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(new AuthError(`Failed to start callback server on port ${REDIRECT_PORT}: ${err.message}`));
    });
  });
}

// 토큰 엔드포인트 에러 응답에서 표준 OAuth 필드(error/error_description)만 추출한다.
// 응답 본문 전체를 그대로 노출하면 예기치 않은 민감 정보가 로그·MCP 컨텍스트로 샐 수 있다.
async function safeErrorSummary(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { error?: string; error_description?: string };
    if (body.error || body.error_description) {
      return [body.error, body.error_description].filter(Boolean).join(": ");
    }
  } catch {
    // JSON이 아니면 아래에서 잘라서 반환
  }
  return text.length > 200 ? text.slice(0, 200) + "..." : text;
}

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<UserTokenResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new AuthError(`Token exchange failed (${res.status}): ${await safeErrorSummary(res)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number | string;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in),
    scope: data.scope,
  };
}

export async function refreshUserToken(
  refreshToken: string,
  profile = "default"
): Promise<UserTokenResult> {
  const creds = await loadCredentials(profile);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new AuthError(`Token refresh failed (${res.status}): ${await safeErrorSummary(res)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number | string;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in),
    scope: data.scope,
  };
}

export function startOAuthCallbackServer(
  clientId: string,
  clientSecret: string,
  expectedState: string,
): Promise<UserTokenResult> {
  return waitForAuthCode(expectedState).then((code) =>
    exchangeCodeForToken(code, clientId, clientSecret)
  );
}

export async function revokeToken(
  token: string,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  try {
    const res = await fetch("https://auth.worksmobile.com/oauth2/v2.0/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    if (!res.ok && process.env["NWORKS_VERBOSE"] === "1") {
      console.error(`[nworks] Token revoke returned ${res.status}`);
    }
  } catch {
    // best-effort: 실패해도 로컬 삭제는 진행
  }
}

export { REDIRECT_URI };
