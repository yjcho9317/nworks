import { AuthError } from "../utils/error.js";
import { loadUserToken, saveUserToken } from "./config.js";
import { refreshUserToken } from "./oauth-user.js";

// 프로필별로 진행 중인 refresh Promise를 공유한다(single-flight).
// 병렬 MCP 도구 호출이 동시에 refresh하면, 나중 저장이 앞선 refresh가 회전시킨
// refresh_token을 덮어써 무효 토큰이 저장(사실상 계정 잠금)될 수 있다.
const inFlightRefresh = new Map<string, Promise<string>>();

export async function getValidUserToken(profile = "default"): Promise<string> {
  const cached = await loadUserToken(profile);

  if (!cached) {
    throw new AuthError(
      "User OAuth token not found. Run `nworks login --user` first."
    );
  }

  if (cached.expiresAt > Date.now() / 1000 + 300) {
    return cached.accessToken;
  }

  return refreshValidUserToken(profile);
}

// 캐시 토큰이 만료 임박이거나 401로 거부됐을 때 single-flight로 refresh한다.
export function refreshValidUserToken(profile = "default"): Promise<string> {
  const existing = inFlightRefresh.get(profile);
  if (existing) return existing;

  const run = doRefresh(profile);
  inFlightRefresh.set(profile, run);
  // 성공/실패와 무관하게 완료되면 in-flight 표시를 지운다.
  void run.finally(() => inFlightRefresh.delete(profile)).catch(() => {});
  return run;
}

async function doRefresh(profile: string): Promise<string> {
  const cached = await loadUserToken(profile);
  if (!cached) {
    throw new AuthError(
      "User OAuth token not found. Run `nworks login --user` first."
    );
  }

  const refreshed = await refreshUserToken(cached.refreshToken, profile);
  await saveUserToken(refreshed, profile);
  return refreshed.accessToken;
}
