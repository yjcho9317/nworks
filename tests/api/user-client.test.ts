import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// token-user는 실제 파일/네트워크를 건드리므로 목으로 대체한다.
const getValidUserToken = vi.fn(async () => "access-token");
const refreshValidUserToken = vi.fn(async () => "access-token-2");
vi.mock("../../src/auth/token-user.js", () => ({
  getValidUserToken: () => getValidUserToken(),
  refreshValidUserToken: () => refreshValidUserToken(),
}));

import { userFetch } from "../../src/api/user-client.js";

const URL_A = "https://www.worksapis.com/v1.0/a";

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response("{}", { status, headers });
}

beforeEach(() => {
  getValidUserToken.mockClear();
  refreshValidUserToken.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("userFetch concurrency", () => {
  it("never runs more than 5 requests to the same host at once", async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return jsonResponse(200);
    }));

    await Promise.all(
      Array.from({ length: 12 }, () => userFetch(URL_A, { method: "GET" }, "default"))
    );

    expect(maxActive).toBeLessThanOrEqual(5);
    vi.unstubAllGlobals();
  });
});

describe("userFetch retry", () => {
  it("refreshes once and retries on 401", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await userFetch(URL_A, { method: "GET" }, "default");

    expect(res.status).toBe(200);
    expect(refreshValidUserToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("does not refresh more than once when 401 persists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401)));

    const res = await userFetch(URL_A, { method: "GET" }, "default");

    expect(res.status).toBe(401);
    expect(refreshValidUserToken).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("backs off and retries on 429 honoring Retry-After", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await userFetch(URL_A, { method: "GET" }, "default");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
