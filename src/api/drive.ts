import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { ApiError, AuthError } from "../utils/error.js";
import { getValidUserToken } from "../auth/token-user.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

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
    throw new AuthError("User token expired. Run `nworks login --user --scope file` again.");
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

export async function listFiles(
  userId = "me",
  folderId?: string,
  count = 20,
  cursor?: string,
  profile = "default"
): Promise<FileListResult> {
  const base = `${BASE_URL}/users/${userId}/drive/files`;
  const path = folderId ? `${base}/${folderId}/children` : base;

  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);

  const url = `${path}?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleError(res);

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
  const fileStat = await stat(localPath);
  const fileSize = fileStat.size;

  const base = `${BASE_URL}/users/${userId}/drive/files`;
  const createUrl = folderId ? `${base}/${folderId}` : base;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${createUrl} (create upload URL)`);
  }

  const createRes = await authedFetch(
    createUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, fileSize, overwrite }),
    },
    profile
  );

  if (!createRes.ok) return handleError(createRes);

  const { uploadUrl } = (await createRes.json()) as UploadUrlResult;
  const fileBuffer = await readFile(localPath);
  const boundary = `----nworks${Date.now()}`;

  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Filedata"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${uploadUrl} (upload content, ${fileSize} bytes)`);
  }

  const uploadRes = await authedFetch(
    uploadUrl,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    },
    profile
  );

  if (!uploadRes.ok) return handleError(uploadRes);

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

  const base = `${BASE_URL}/users/${userId}/drive/files`;
  const createUrl = folderId ? `${base}/${folderId}` : base;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${createUrl} (create upload URL for buffer)`);
  }

  const createRes = await authedFetch(
    createUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, fileSize, overwrite }),
    },
    profile
  );

  if (!createRes.ok) return handleError(createRes);

  const { uploadUrl } = (await createRes.json()) as UploadUrlResult;
  const boundary = `----nworks${Date.now()}`;

  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Filedata"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${uploadUrl} (upload buffer, ${fileSize} bytes)`);
  }

  const uploadRes = await authedFetch(
    uploadUrl,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    },
    profile
  );

  if (!uploadRes.ok) return handleError(uploadRes);

  return (await uploadRes.json()) as UploadResult;
}

export async function downloadFile(
  fileId: string,
  userId = "me",
  profile = "default"
): Promise<{ buffer: Buffer; fileName?: string }> {
  const url = `${BASE_URL}/users/${userId}/drive/files/${fileId}/download`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url} (get download URL)`);
  }

  const redirectRes = await authedFetch(
    url,
    { method: "GET", redirect: "manual" },
    profile
  );

  if (redirectRes.status === 401) {
    throw new AuthError("User token expired. Run `nworks login --user --scope file` again.");
  }

  const location = redirectRes.headers.get("location");
  if (!location) {
    if (!redirectRes.ok) return handleError(redirectRes);
    throw new ApiError("NO_REDIRECT", "No download URL returned", redirectRes.status);
  }

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${location} (download content)`);
  }

  const downloadRes = await authedFetch(location, { method: "GET" }, profile);

  if (!downloadRes.ok) return handleError(downloadRes);

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
