import { getValidUserToken, refreshValidUserToken } from "../auth/token-user.js";
import { ApiError, AuthError } from "../utils/error.js";

const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_SECONDS = 60;
// LINE WORKS 정책: 한 도메인에 동시 5호출 이하. HTTP host를 도메인 근사치로 삼아 상한을 건다.
const MAX_CONCURRENT_PER_HOST = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// host별 동시 요청 수를 제한하는 세마포어.
class HostSemaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    // 슬롯이 없으면 대기. 깨어날 때 release()가 슬롯을 그대로 넘겨주므로
    // 여기서 active를 다시 증가시키지 않는다(그러면 정원을 초과 수용한다).
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      // 대기자에게 슬롯을 그대로 넘긴다(active 유지). 감소 후 재증가 사이에
      // 새 acquire가 끼어들어 상한을 넘기는 경쟁을 피한다.
      next();
    } else {
      this.active--;
    }
  }
}

const semaphores = new Map<string, HostSemaphore>();

function semaphoreFor(host: string): HostSemaphore {
  let semaphore = semaphores.get(host);
  if (!semaphore) {
    semaphore = new HostSemaphore(MAX_CONCURRENT_PER_HOST);
    semaphores.set(host, semaphore);
  }
  return semaphore;
}

/**
 * User OAuth 토큰으로 인증된 요청을 보낸다. 5개 도메인 API 모듈이 공유한다.
 * - 401: single-flight refresh 후 1회 재시도(토큰 만료·회전·시계 오차 대응)
 * - 429: Retry-After를 따라 백오프 후 재시도(최대 MAX_RETRIES회)
 * - host별 동시 요청 5 이하로 제한
 * 성공 상태 코드는 호출 측이 확인하고, 실패 시 handleUserApiError를 호출한다.
 */
export async function userFetch(
  url: string,
  init: RequestInit,
  profile: string
): Promise<Response> {
  let refreshedOn401 = false;

  for (let attempt = 0; ; attempt++) {
    const res = await fetchOnce(url, init, profile);

    if (res.status === 401 && !refreshedOn401) {
      refreshedOn401 = true;
      await refreshValidUserToken(profile);
      continue;
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      await sleep(retryAfterMs(res));
      continue;
    }

    return res;
  }
}

// 세마포어는 단일 요청 동안만 잡고, refresh·백오프 대기 중에는 슬롯을 점유하지 않는다.
async function fetchOnce(
  url: string,
  init: RequestInit,
  profile: string
): Promise<Response> {
  const host = new URL(url).host;
  const semaphore = semaphoreFor(host);
  await semaphore.acquire();
  try {
    const token = await getValidUserToken(profile);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return await fetch(url, { ...init, headers });
  } finally {
    semaphore.release();
  }
}

function retryAfterMs(res: Response): number {
  const raw = parseInt(res.headers.get("Retry-After") ?? "5", 10);
  const seconds = Math.min(Number.isNaN(raw) ? 5 : raw, MAX_RETRY_AFTER_SECONDS);
  return seconds * 1000;
}

/** User OAuth API 응답의 공통 에러 처리. 성공 상태 확인 후 !ok일 때 호출한다. */
export async function handleUserApiError(res: Response): Promise<never> {
  if (res.status === 401) {
    throw new AuthError(
      "User token expired or revoked. Run `nworks login --user` again."
    );
  }
  let code = "UNKNOWN";
  let description = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { code?: string; description?: string };
    code = body.code ?? code;
    description = body.description ?? description;
  } catch {
    // ignore
  }
  throw new ApiError(code, description, res.status);
}
