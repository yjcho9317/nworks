import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { ApiError } from "../utils/error.js";
import { userFetch, handleUserApiError } from "./user-client.js";
import { sanitizePathSegment, sanitizeFileName, validateRedirectUrl } from "../utils/sanitize.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

// download 엔드포인트의 302 Location은 apis-storage 호스트를 가리킨다.
// storage.worksmobile.com의 하위 도메인이 아니므로 별도 항목으로 허용해야 한다.
const ALLOWED_HOSTS = [
  "storage.worksmobile.com",
  "apis-storage.worksmobile.com",
  "www.worksapis.com",
  "worksapis.com",
];

export interface DriveFile {
  fileId: string;
  parentFileId?: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  fileType: string;
  createdTime: string;
  modifiedTime: string;
  accessedTime?: string;
  statuses?: string[];
  shared?: boolean;
}

export interface FileListResult {
  files: DriveFile[];
  responseMetaData?: { nextCursor?: string };
}

export interface UploadUrlResult {
  uploadUrl: string;
  offset: number;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  fileSize: string;
  filePath: string;
  fileType: string;
}

export interface SharedDrive {
  sharedriveId: string;
  name: string;
  description?: string;
  permissionType?: string;
  hasPermission?: boolean;
}

export interface SharedDriveListResult {
  sharedDrives: SharedDrive[];
  responseMetaData?: { nextCursor?: string };
}

export async function listFiles(
  userId = "me",
  folderId?: string,
  count = 20,
  cursor?: string,
  profile = "default"
): Promise<FileListResult> {
  const base = `${BASE_URL}/users/${sanitizePathSegment(userId)}/drive/files`;
  const path = folderId ? `${base}/${sanitizePathSegment(folderId)}/children` : base;

  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);

  const url = `${path}?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleUserApiError(res);

  const data = (await res.json()) as FileListResult;
  return { files: data.files ?? [], responseMetaData: data.responseMetaData };
}

export async function uploadFile(
  localPath: string,
  userId = "me",
  folderId?: string,
  overwrite = false,
  profile = "default"
): Promise<UploadResult> {
  const fileName = basename(localPath);
  const safeName = sanitizeFileName(fileName);
  const fileStat = await stat(localPath);
  const fileSize = fileStat.size;

  if (fileSize > MAX_UPLOAD_SIZE) {
    throw new ApiError("FILE_TOO_LARGE", `File size (${fileSize} bytes) exceeds maximum allowed (${MAX_UPLOAD_SIZE} bytes)`, 413);
  }

  const base = `${BASE_URL}/users/${sanitizePathSegment(userId)}/drive/files`;
  const createUrl = folderId ? `${base}/${sanitizePathSegment(folderId)}` : base;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${createUrl} (create upload URL)`);
  }

  const createRes = await userFetch(
    createUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, fileSize, overwrite }),
    },
    profile
  );

  if (!createRes.ok) return handleUserApiError(createRes);

  const { uploadUrl } = (await createRes.json()) as UploadUrlResult;
  validateRedirectUrl(uploadUrl, ALLOWED_HOSTS);
  const fileBuffer = await readFile(localPath);
  const boundary = `----nworks${Date.now()}`;

  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Filedata"; filename="${safeName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${uploadUrl} (upload content, ${fileSize} bytes)`);
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

  return (await uploadRes.json()) as UploadResult;
}

export async function uploadBuffer(
  fileBuffer: Buffer,
  fileName: string,
  userId = "me",
  folderId?: string,
  overwrite = false,
  profile = "default"
): Promise<UploadResult> {
  const fileSize = fileBuffer.length;

  if (fileSize > MAX_UPLOAD_SIZE) {
    throw new ApiError("FILE_TOO_LARGE", `File size (${fileSize} bytes) exceeds maximum allowed (${MAX_UPLOAD_SIZE} bytes)`, 413);
  }

  const base = `${BASE_URL}/users/${sanitizePathSegment(userId)}/drive/files`;
  const createUrl = folderId ? `${base}/${sanitizePathSegment(folderId)}` : base;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${createUrl} (create upload URL for buffer)`);
  }

  const createRes = await userFetch(
    createUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, fileSize, overwrite }),
    },
    profile
  );

  if (!createRes.ok) return handleUserApiError(createRes);

  const { uploadUrl } = (await createRes.json()) as UploadUrlResult;
  validateRedirectUrl(uploadUrl, ALLOWED_HOSTS);
  const boundary = `----nworks${Date.now()}`;

  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Filedata"; filename="${sanitizeFileName(fileName)}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${uploadUrl} (upload buffer, ${fileSize} bytes)`);
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

  return (await uploadRes.json()) as UploadResult;
}

// 개인 드라이브와 공유 드라이브 모두 download 엔드포인트가 302로 스토리지 URL을
// 돌려주는 동일한 흐름이라 리다이렉트 처리를 공유한다.
async function downloadViaRedirect(
  url: string,
  profile: string
): Promise<{ buffer: Buffer; fileName?: string }> {
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url} (get download URL)`);
  }

  const redirectRes = await userFetch(
    url,
    { method: "GET", redirect: "manual" },
    profile
  );

  const location = redirectRes.headers.get("location");
  if (!location) {
    if (!redirectRes.ok) return handleUserApiError(redirectRes);
    throw new ApiError("NO_REDIRECT", "No download URL returned", redirectRes.status);
  }

  const safeLocation = validateRedirectUrl(location, ALLOWED_HOSTS);

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${safeLocation} (download content)`);
  }

  // 스토리지 호스트도 Bearer 토큰을 요구한다(헤더 없이 호출하면 401).
  // 토큰을 실어 보내도 되는 이유는 바로 위 validateRedirectUrl이 호스트를
  // 화이트리스트로 검증한 뒤이기 때문이다. 검증 전에 호출하면 토큰이 샌다.
  const downloadRes = await userFetch(safeLocation, { method: "GET" }, profile);

  if (!downloadRes.ok) return handleUserApiError(downloadRes);

  const arrayBuffer = await downloadRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const disposition = downloadRes.headers.get("content-disposition");
  let fileName: string | undefined;
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (match?.[1]) {
      fileName = decodeURIComponent(match[1].replace(/"/g, ""));
    }
  }

  return { buffer, fileName };
}

export async function downloadFile(
  fileId: string,
  userId = "me",
  profile = "default"
): Promise<{ buffer: Buffer; fileName?: string }> {
  const url = `${BASE_URL}/users/${sanitizePathSegment(userId)}/drive/files/${sanitizePathSegment(fileId)}/download`;
  return downloadViaRedirect(url, profile);
}

export async function listSharedDrives(
  count = 20,
  cursor?: string,
  profile = "default"
): Promise<SharedDriveListResult> {
  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);

  const url = `${BASE_URL}/sharedrives?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleUserApiError(res);

  // 이 엔드포인트만 목록 키가 camelCase가 아닌 전부 소문자 "sharedrives"다.
  const data = (await res.json()) as {
    sharedrives?: SharedDrive[];
    responseMetaData?: { nextCursor?: string };
  };
  return { sharedDrives: data.sharedrives ?? [], responseMetaData: data.responseMetaData };
}

export async function listSharedDriveFiles(
  sharedriveId: string,
  folderId?: string,
  count = 20,
  cursor?: string,
  profile = "default"
): Promise<FileListResult> {
  const base = `${BASE_URL}/sharedrives/${sanitizePathSegment(sharedriveId)}/files`;
  const path = folderId ? `${base}/${sanitizePathSegment(folderId)}/children` : base;

  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);

  const url = `${path}?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleUserApiError(res);

  const data = (await res.json()) as FileListResult;
  return { files: data.files ?? [], responseMetaData: data.responseMetaData };
}

export async function downloadSharedDriveFile(
  sharedriveId: string,
  fileId: string,
  profile = "default"
): Promise<{ buffer: Buffer; fileName?: string }> {
  const url = `${BASE_URL}/sharedrives/${sanitizePathSegment(sharedriveId)}/files/${sanitizePathSegment(fileId)}/download`;
  return downloadViaRedirect(url, profile);
}
