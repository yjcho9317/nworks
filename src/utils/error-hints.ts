import { ApiError, AuthError } from "./error.js";

/** Scope required by each command/API area */
export const REQUIRED_SCOPES: Record<string, string> = {
  calendar: "calendar",
  "calendar.list": "calendar.read",
  "calendar.create": "calendar calendar.read",
  "calendar.update": "calendar calendar.read",
  "calendar.delete": "calendar calendar.read",
  mail: "mail",
  "mail.send": "mail",
  "mail.list": "mail.read",
  "mail.read": "mail.read",
  task: "task",
  "task.list": "task.read",
  "task.create": "task user.read",
  "task.update": "task user.read",
  "task.delete": "task user.read",
  drive: "file",
  "drive.list": "file.read",
  "drive.upload": "file",
  "drive.download": "file.read",
  board: "board",
  "board.list": "board.read",
  "board.posts": "board.read",
  "board.read": "board.read",
  "board.create": "board",
};

const ERROR_HINTS_CLI: Record<string, string> = {
  FORBIDDEN: "권한이 부족합니다. Developer Console에서 OAuth Scope를 확인하세요.",
  ACCESS_DENIED: "접근이 거부됐습니다. Admin에서 Bot을 추가했는지 확인하세요.",
  SERVICE_ACCOUNT_NOT_ALLOWED:
    "서비스 계정으로는 이 API를 사용할 수 없습니다. `nworks login --user`로 User OAuth 로그인하세요.",
  UNAUTHORIZED: "인증이 만료됐습니다. `nworks login`으로 다시 로그인하세요.",
};

const ERROR_HINTS_MCP: Record<string, string> = {
  FORBIDDEN: "권한이 부족합니다. Developer Console에서 OAuth Scope를 확인하세요.",
  ACCESS_DENIED: "접근이 거부됐습니다. Admin에서 Bot을 추가했는지 확인하세요.",
  SERVICE_ACCOUNT_NOT_ALLOWED:
    "서비스 계정으로는 이 API를 사용할 수 없습니다. nworks_login_user tool로 User OAuth 로그인을 먼저 해주세요.",
  UNAUTHORIZED: "인증이 만료됐습니다. nworks_setup tool로 재설정하세요.",
};

/**
 * Build a user-friendly hint string for CLI error output.
 * @param err  The thrown error
 * @param area Optional command area (e.g. "calendar.list") to suggest the exact scope
 */
export function cliErrorHint(err: unknown, area?: string): string {
  if (err instanceof ApiError) {
    const hint = ERROR_HINTS_CLI[err.code];
    const scopeHint = area ? buildScopeHint(area, "cli") : "";
    if (hint) {
      return `[${err.code}] ${err.message}\n  → ${hint}${scopeHint}`;
    }
    return `[${err.code}] ${err.message}${scopeHint}`;
  }
  if (err instanceof AuthError) {
    return `${err.message}\n  → ${ERROR_HINTS_CLI["UNAUTHORIZED"]}`;
  }
  return (err as Error).message;
}

/**
 * Build a user-friendly hint string for MCP tool error output.
 */
export function mcpErrorHint(err: unknown, area?: string): string {
  if (err instanceof ApiError) {
    const hint = ERROR_HINTS_MCP[err.code];
    const scopeHint = area ? buildScopeHint(area, "mcp") : "";
    if (hint) {
      return `Error: [${err.code}] ${err.message}\n\n[안내] ${hint}${scopeHint}`;
    }
    return `Error: [${err.code}] ${err.message}${scopeHint}`;
  }
  if (err instanceof AuthError) {
    return `Error: ${err.message}\n\n[안내] 인증 정보가 없습니다. nworks_setup tool로 Client ID/Secret을 먼저 설정해주세요.`;
  }
  return `Error: ${(err as Error).message}`;
}

function buildScopeHint(area: string, mode: "cli" | "mcp"): string {
  const scope = REQUIRED_SCOPES[area];
  if (!scope) return "";
  const scopes = scope.split(" ").join(", ");
  if (mode === "cli") {
    return `\n  → 이 명령어는 ${scopes} scope가 필요합니다. \`nworks login --user --scope "${scope}"\`를 실행하세요.`;
  }
  return `\n  → 이 API는 ${scopes} scope가 필요합니다. nworks_login_user tool로 로그인하세요 (scope를 지정하지 않으면 전체 권한이 자동 포함됩니다).`;
}
