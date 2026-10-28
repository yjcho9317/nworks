import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { ApiError } from "../utils/error.js";
import { userFetch, handleUserApiError } from "./user-client.js";
import { sanitizePathSegment, sanitizeFileName, validateRedirectUrl } from "../utils/sanitize.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB (drive 업로드와 동일)

// 첨부 uploadUrl은 storage 호스트를 가리킨다. drive 업로드와 같은 허용 목록.
const ALLOWED_UPLOAD_HOSTS = [
  "storage.worksmobile.com",
  "apis-storage.worksmobile.com",
  "www.worksapis.com",
  "worksapis.com",
];

// 첨부 추가 API는 contentType이 필수다. 모르는 확장자는 octet-stream.
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

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

export interface AttachmentResult {
  fileName: string;
  fileSize: number;
  contentType: string;
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

/** 게시글에 첨부파일을 추가한다: 업로드 URL 발급 → multipart 업로드 */
export async function addPostAttachment(
  boardId: string,
  postId: string,
  localPath: string,
  profile = "default"
): Promise<AttachmentResult> {
  const fileName = basename(localPath);
  const safeName = sanitizeFileName(fileName);
  const fileSize = (await stat(localPath)).size;

  if (fileSize > MAX_ATTACHMENT_SIZE) {
    throw new ApiError("FILE_TOO_LARGE", `File size (${fileSize} bytes) exceeds maximum allowed (${MAX_ATTACHMENT_SIZE} bytes)`, 413);
  }

  const contentType = CONTENT_TYPES[extname(fileName).toLowerCase()] ?? "application/octet-stream";
  const createUrl = `${BASE_URL}/boards/${sanitizePathSegment(boardId)}/posts/${sanitizePathSegment(postId)}/attachments`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${createUrl} (create attachment upload URL)`);
  }

  const createRes = await userFetch(
    createUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, fileSize, contentType }),
    },
    profile
  );

  if (!createRes.ok) return handleUserApiError(createRes);

  const { uploadUrl } = (await createRes.json()) as { uploadUrl: string };
  validateRedirectUrl(uploadUrl, ALLOWED_UPLOAD_HOSTS);
  const fileBuffer = await readFile(localPath);
  const boundary = `----nworks${Date.now()}`;

  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Filedata"; filename="${safeName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${uploadUrl} (upload attachment, ${fileSize} bytes)`);
  }

  const uploadRes = await userFetch(
    uploadUrl,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    },
    profile
  );

  if (!uploadRes.ok) return handleUserApiError(uploadRes);
  await uploadRes.text();

  return { fileName, fileSize, contentType };
}
