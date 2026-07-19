import { userFetch, handleUserApiError } from "./user-client.js";
import { sanitizePathSegment } from "../utils/sanitize.js";

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

  const res = await userFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleUserApiError(res);

  const text = await res.text();
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Response: ${res.status} (${text.length} bytes)`);
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

  const url = `${BASE_URL}/boards/${sanitizePathSegment(boardId)}/posts?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleUserApiError(res);

  const text = await res.text();
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Response: ${res.status} (${text.length} bytes)`);
  }

  const data = safeParseJson<PostListResult>(text);
  return { posts: data.posts ?? [], responseMetaData: data.responseMetaData };
}

export async function readPost(
  boardId: string,
  postId: string,
  profile = "default"
): Promise<Post> {
  const url = `${BASE_URL}/boards/${sanitizePathSegment(boardId)}/posts/${sanitizePathSegment(postId)}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleUserApiError(res);

  const text = await res.text();
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Response: ${res.status} (${text.length} bytes)`);
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

  const url = `${BASE_URL}/boards/${sanitizePathSegment(opts.boardId)}/posts`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
    console.error(`[nworks] Body: ${JSON.stringify(body).length} bytes`);
  }

  const res = await userFetch(
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
      console.error(`[nworks] Response: ${res.status} (${text.length} bytes)`);
    }
    return safeParseJson<Post>(text);
  }
  return handleUserApiError(res);
}
