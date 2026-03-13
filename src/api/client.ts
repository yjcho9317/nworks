import { ApiError, AuthError } from "../utils/error.js";
import { getValidToken, refreshToken } from "../auth/token.js";

const BASE_URL = "https://www.worksapis.com/v1.0";
const MAX_RETRIES = 3;

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  profile?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function request<T>(
  opts: RequestOptions,
  _retryCount = 0
): Promise<T> {
  const { method, path, body, profile = "default" } = opts;
  const token = await getValidToken(profile);

  const url = `${BASE_URL}${path}`;
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] ${method} ${url}`);
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && _retryCount === 0) {
    await refreshToken(profile);
    return request<T>(opts, _retryCount + 1);
  }

  if (res.status === 429 && _retryCount < MAX_RETRIES) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
    await sleep(retryAfter * 1000);
    return request<T>(opts, _retryCount + 1);
  }

  if (!res.ok) {
    let code = "UNKNOWN";
    let description = `HTTP ${res.status}`;

    try {
      const errorBody = (await res.json()) as {
        code?: string;
        description?: string;
      };
      code = errorBody.code ?? code;
      description = errorBody.description ?? description;
    } catch {
      // ignore
    }

    if (res.status === 401) {
      throw new AuthError(description);
    }
    throw new ApiError(code, description, res.status);
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
