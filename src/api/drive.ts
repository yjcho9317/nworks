import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { ApiError } from "../utils/error.js";
import { userFetch, handleUserApiError } from "./user-client.js";
import { sanitizePathSegment, sanitizeFileName, validateRedirectUrl } from "../utils/sanitize.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_HOSTS = [
  "storage.worksmobile.com",
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

export async function downloadFile(
  fileId: string,
  userId = "me",
  profile = "default"
): Promise<{ buffer: Buffer; fileName?: string }> {
  const url = `${BASE_URL}/users/${sanitizePathSegment(userId)}/drive/files/${sanitizePathSegment(fileId)}/download`;

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

  const downloadRes = await fetch(safeLocation, { method: "GET" });

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
