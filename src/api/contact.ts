import { userFetch, handleUserApiError } from "./user-client.js";
import { sanitizePathSegment } from "../utils/sanitize.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

export interface ContactName {
  lastName?: string | null;
  firstName?: string | null;
  phoneticLastName?: string | null;
  phoneticFirstName?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  middleName?: string | null;
  nickName?: string | null;
}

export interface ContactEmail {
  email: string;
  type?: string | null;
  customType?: string | null;
  primary?: boolean;
}

export interface ContactTelephone {
  telephone: string;
  type?: string | null;
  customType?: string | null;
  primary?: boolean;
}

export interface ContactOrganization {
  name?: string | null;
  department?: string | null;
  title?: string | null;
  primary?: boolean;
}

// 연락처는 이름 하나에 이메일·전화·소속을 여러 개 달 수 있어 API가 전부 배열로
// 돌려준다. 단수 필드(email, tel)로 접으면 두 번째 값부터 조용히 사라진다.
export interface Contact {
  contactId: string;
  contactName: ContactName;
  emails?: ContactEmail[];
  telephones?: ContactTelephone[];
  organizations?: ContactOrganization[];
  contactTagIds?: string[];
  memo?: string | null;
  createdTime?: string;
  modifiedTime?: string;
}

export interface ContactListResult {
  contacts: Contact[];
  responseMetaData?: { nextCursor?: string };
}

export interface ContactTag {
  contactTagId: string;
  contactTagName: string;
}

export interface ContactTagListResult {
  contactTags: ContactTag[];
  responseMetaData?: { nextCursor?: string };
}

export interface ListContactsOptions {
  userId?: string;
  count?: number;
  cursor?: string;
  accessibleRange?: "ALL" | "MEMBER";
  contactTagId?: string;
  email?: string;
  telephone?: string;
  orderBy?: string;
  searchDateType?: "CREATED_TIME" | "MODIFIED_TIME";
  startDateTime?: string;
  endDateTime?: string;
  profile?: string;
}

export interface ListContactTagsOptions {
  userId?: string;
  count?: number;
  cursor?: string;
  profile?: string;
}

export async function listContacts(opts: ListContactsOptions = {}): Promise<ContactListResult> {
  const userId = opts.userId ?? "me";
  const profile = opts.profile ?? "default";

  const params = new URLSearchParams();
  params.set("count", String(opts.count ?? 20));
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.accessibleRange) params.set("accessibleRange", opts.accessibleRange);
  if (opts.contactTagId) params.set("contactTagId", opts.contactTagId);
  if (opts.email) params.set("email", opts.email);
  if (opts.telephone) params.set("telephone", opts.telephone);
  if (opts.orderBy) params.set("orderBy", opts.orderBy);
  if (opts.searchDateType) params.set("searchDateType", opts.searchDateType);
  if (opts.startDateTime) params.set("startDateTime", opts.startDateTime);
  if (opts.endDateTime) params.set("endDateTime", opts.endDateTime);

  const url = `${BASE_URL}/users/${sanitizePathSegment(userId)}/contacts?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleUserApiError(res);

  const data = (await res.json()) as ContactListResult;
  return { contacts: data.contacts ?? [], responseMetaData: data.responseMetaData };
}

export async function getContact(contactId: string, profile = "default"): Promise<Contact> {
  const url = `${BASE_URL}/contacts/${sanitizePathSegment(contactId)}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleUserApiError(res);

  return (await res.json()) as Contact;
}

export async function createContact(
  payload: Record<string, unknown>,
  profile = "default"
): Promise<Contact> {
  const url = `${BASE_URL}/contacts`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
  }

  const res = await userFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    profile
  );

  if (!res.ok) return handleUserApiError(res);

  return (await res.json()) as Contact;
}

export async function updateContact(
  contactId: string,
  payload: Record<string, unknown>,
  partial = true,
  profile = "default"
): Promise<Contact> {
  const url = `${BASE_URL}/contacts/${sanitizePathSegment(contactId)}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] ${partial ? "PATCH" : "PUT"} ${url}`);
  }

  const res = await userFetch(
    url,
    {
      method: partial ? "PATCH" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    profile
  );

  if (!res.ok) return handleUserApiError(res);

  return (await res.json()) as Contact;
}

export async function deleteContact(contactId: string, profile = "default"): Promise<void> {
  const url = `${BASE_URL}/contacts/${sanitizePathSegment(contactId)}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] DELETE ${url}`);
  }

  const res = await userFetch(url, { method: "DELETE" }, profile);

  if (res.status === 204) return;

  if (!res.ok) return handleUserApiError(res);
}

export async function listContactTags(
  opts: ListContactTagsOptions = {}
): Promise<ContactTagListResult> {
  const userId = opts.userId ?? "me";
  const profile = opts.profile ?? "default";

  const params = new URLSearchParams();
  params.set("count", String(opts.count ?? 20));
  if (opts.cursor) params.set("cursor", opts.cursor);

  const url = `${BASE_URL}/users/${sanitizePathSegment(userId)}/contact-tags?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await userFetch(url, { method: "GET" }, profile);

  if (!res.ok) return handleUserApiError(res);

  const data = (await res.json()) as ContactTagListResult;
  return { contactTags: data.contactTags ?? [], responseMetaData: data.responseMetaData };
}
