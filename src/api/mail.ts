import { ApiError, AuthError } from "../utils/error.js";
import { getValidUserToken } from "../auth/token-user.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

export interface MailAddress {
  name?: string;
  email: string;
}

export interface SendMailOptions {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body?: string;
  contentType?: "html" | "text";
  userId?: string;
  profile?: string;
}

export interface MailSummary {
  mailId: number;
  folderId: number;
  status: string;
  from: MailAddress;
  to: MailAddress[];
  subject: string;
  receivedTime: string;
  sentTime?: string;
  size: number;
  isImportant?: boolean;
  attachCount?: number;
}

export interface MailListResult {
  mails: MailSummary[];
  unreadCount?: number;
  folderName?: string;
  totalCount?: number;
  responseMetaData?: { nextCursor?: string };
}

export interface MailDetail {
  mail: {
    mailId: number;
    folderId: number;
    status: number;
    from: MailAddress;
    to: MailAddress[];
    cc?: MailAddress[];
    bcc?: MailAddress[];
    subject: string;
    body: string;
    receivedTime: string;
    sentTime?: string;
    size: number;
    securityLevel?: string;
  };
  attachments?: Array<{
    attachmentId: number;
    contentType: string;
    filename: string;
    size: number;
  }>;
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
    throw new AuthError("User token expired. Run `nworks login --user --scope mail` again.");
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

export async function sendMail(opts: SendMailOptions): Promise<void> {
  const userId = opts.userId ?? "me";
  const profile = opts.profile ?? "default";
  const url = `${BASE_URL}/users/${userId}/mail`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
  }

  const body: Record<string, unknown> = {
    to: opts.to,
    subject: opts.subject,
  };
  if (opts.body !== undefined) body.body = opts.body;
  if (opts.cc) body.cc = opts.cc;
  if (opts.bcc) body.bcc = opts.bcc;
  if (opts.contentType) body.contentType = opts.contentType;

  const res = await authedFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    profile
  );

  if (res.status === 202) return;

  if (!res.ok) return handleError(res);
}

export async function listMails(
  folderId = 0,
  userId = "me",
  count = 30,
  cursor?: string,
  isUnread?: boolean,
  profile = "default"
): Promise<MailListResult> {
  const params = new URLSearchParams();
  params.set("count", String(count));
  if (cursor) params.set("cursor", cursor);
  if (isUnread) params.set("isUnread", "true");

  const url = `${BASE_URL}/users/${userId}/mail/mailfolders/${folderId}/children?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleError(res);

  const data = (await res.json()) as MailListResult;
  return {
    mails: data.mails ?? [],
    unreadCount: data.unreadCount,
    folderName: data.folderName,
    totalCount: data.totalCount,
    responseMetaData: data.responseMetaData,
  };
}

export async function readMail(
  mailId: number,
  userId = "me",
  profile = "default"
): Promise<MailDetail> {
  const url = `${BASE_URL}/users/${userId}/mail/${mailId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleError(res);

  return (await res.json()) as MailDetail;
}
