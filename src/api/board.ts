import { ApiError, AuthError } from "../utils/error.js";
import { getValidUserToken } from "../auth/token-user.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

export interface Board {
  boardId: string;
  boardName: string;
  description?: string;
  createdTime?: string;
  domainId?: string;
}

export interface BoardListResult {
  boards: Board[];
  responseMetaData?: { nextCursor?: string };
}

export interface Post {
  boardId: string;
  postId: string;
  title: string;
  body?: string;
  readCount?: number;
  userName?: string;
  userId?: string;
  createdTime?: string;
  updatedTime?: string;
  commentCount?: number;
  enableComment?: boolean;
}

export interface PostListResult {
  posts: Post[];
  responseMetaData?: { nextCursor?: string };
}

export interface CreatePostOptions {
  boardId: string;
  title: string;
  body?: string;
  enableComment?: boolean;
  sendNotifications?: boolean;
  profile?: string;
}

async function authedFetch(
  url: string,
  init: RequestInit,
  profile: string
): Promise<Response> {
  const token = await getValidUserToken(profile);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function handleError(res: Response): Promise<never> {
  if (res.status === 401) {
    throw new AuthError("User token expired. Run `nworks login --user --scope board` again.");
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

/** int64 ID 필드의 정밀도 손실 방지를 위해 문자열로 변환 후 파싱 */
function safeParseJson<T>(text: string): T {
  const safe = text.replace(
    /"((?:board|post|domain|user)Id)"\s*:\s*(\d{16,})/g,
    '"$1":"$2"'
  );
  return JSON.parse(safe) as T;
}

export async function listBoards(
  count = 20,
  cursor?: string,
  profile = "default"
): Promise<BoardListResult> {
  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);

  const url = `${BASE_URL}/boards?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const text = await res.text();
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Response: ${text}`);
  }

  const data = safeParseJson<BoardListResult>(text);
  return { boards: data.boards ?? [], responseMetaData: data.responseMetaData };
}

export async function listPosts(
  boardId: string,
  count = 20,
  cursor?: string,
  profile = "default"
): Promise<PostListResult> {
  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);

  const url = `${BASE_URL}/boards/${boardId}/posts?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const text = await res.text();
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Response: ${text}`);
  }

  const data = safeParseJson<PostListResult>(text);
  return { posts: data.posts ?? [], responseMetaData: data.responseMetaData };
}

export async function readPost(
  boardId: string,
  postId: string,
  profile = "default"
): Promise<Post> {
  const url = `${BASE_URL}/boards/${boardId}/posts/${postId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const text = await res.text();
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Response: ${text}`);
  }

  return safeParseJson<Post>(text);
}

export async function createPost(opts: CreatePostOptions): Promise<Post> {
  const profile = opts.profile ?? "default";

  const body: Record<string, unknown> = {
    title: opts.title,
    body: opts.body ?? "",
  };
  if (opts.enableComment !== undefined) body.enableComment = opts.enableComment;
  if (opts.sendNotifications !== undefined) body.sendNotifications = opts.sendNotifications;

  const url = `${BASE_URL}/boards/${opts.boardId}/posts`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
    console.error(`[nworks] Body: ${JSON.stringify(body, null, 2)}`);
  }

  const res = await authedFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    profile
  );

  if (res.status === 201 || res.ok) {
    const text = await res.text();
    if (process.env["NWORKS_VERBOSE"] === "1") {
      console.error(`[nworks] Response: ${text}`);
    }
    return safeParseJson<Post>(text);
  }
  return handleError(res);
}
