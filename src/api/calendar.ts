import { randomUUID } from "node:crypto";
import { ApiError, AuthError } from "../utils/error.js";
import { getValidUserToken } from "../auth/token-user.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

export interface CalendarEvent {
  eventId: string;
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  transparency?: string;
  visibility?: string;
  attendees?: Array<{ email?: string; displayName?: string }>;
  createdTime?: { dateTime?: string; timeZone?: string };
  updatedTime?: { dateTime?: string; timeZone?: string };
  viewUrl?: string;
}

export interface EventListResult {
  events: Array<{
    eventComponents: CalendarEvent[];
    organizerCalendarId?: string;
  }>;
}

export interface CreateEventOptions {
  summary: string;
  start: string;
  end: string;
  timeZone?: string;
  description?: string;
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  transparency?: "OPAQUE" | "TRANSPARENT";
  visibility?: "PUBLIC" | "PRIVATE";
  sendNotification?: boolean;
  userId?: string;
  profile?: string;
}

export interface UpdateEventOptions {
  eventId: string;
  summary?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  description?: string;
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  transparency?: "OPAQUE" | "TRANSPARENT";
  visibility?: "PUBLIC" | "PRIVATE";
  sendNotification?: boolean;
  userId?: string;
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
    throw new AuthError("User token expired. Run `nworks login --user --scope calendar` again.");
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

function generateEventId(): string {
  return `event-${randomUUID()}`;
}

/** 초가 없으면 :00 추가 (API 요구사항) */
function normalizeDateTime(dt: string): string {
  const match = dt.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})([+-]\d{2}:\d{2}|Z)?$/);
  if (match) {
    return `${match[1]}:00${match[2] ?? ""}`;
  }
  return dt;
}

export async function listEvents(
  fromDateTime: string,
  untilDateTime: string,
  userId = "me",
  profile = "default"
): Promise<EventListResult> {
  const from = encodeURIComponent(fromDateTime);
  const until = encodeURIComponent(untilDateTime);

  const url = `${BASE_URL}/users/${userId}/calendar/events?fromDateTime=${from}&untilDateTime=${until}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const data = (await res.json()) as EventListResult;
  return { events: data.events ?? [] };
}

export async function createEvent(
  opts: CreateEventOptions
): Promise<{ eventComponents: CalendarEvent[]; organizerCalendarId?: string }> {
  const userId = opts.userId ?? "me";
  const profile = opts.profile ?? "default";
  const timeZone = opts.timeZone ?? "Asia/Seoul";

  const eventId = generateEventId();

  const eventComponent: Record<string, unknown> = {
    eventId,
    summary: opts.summary,
    start: { dateTime: normalizeDateTime(opts.start), timeZone },
    end: { dateTime: normalizeDateTime(opts.end), timeZone },
  };
  if (opts.description) eventComponent.description = opts.description;
  if (opts.location) eventComponent.location = opts.location;
  if (opts.transparency) eventComponent.transparency = opts.transparency;
  if (opts.visibility) eventComponent.visibility = opts.visibility;
  if (opts.attendees) {
    eventComponent.attendees = opts.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName ?? "",
      partstat: "NEEDS-ACTION",
      isOptional: false,
      isResource: false,
    }));
  }

  const body = {
    eventComponents: [eventComponent],
    sendNotification: opts.sendNotification ?? false,
  };

  const url = `${BASE_URL}/users/${userId}/calendar/events`;

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

  if (res.status === 201) {
    return (await res.json()) as { eventComponents: CalendarEvent[]; organizerCalendarId?: string };
  }
  if (!res.ok) return handleError(res);
  return (await res.json()) as { eventComponents: CalendarEvent[]; organizerCalendarId?: string };
}

export async function getEvent(
  eventId: string,
  userId = "me",
  profile = "default"
): Promise<CalendarEvent> {
  const url = `${BASE_URL}/users/${userId}/calendar/events/${eventId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const data = (await res.json()) as { eventComponents: CalendarEvent[] };
  const event = data.eventComponents[0];
  if (!event) throw new ApiError("NOT_FOUND", "Event not found", 404);
  return event;
}

export async function updateEvent(
  opts: UpdateEventOptions
): Promise<void> {
  const userId = opts.userId ?? "me";
  const profile = opts.profile ?? "default";
  const timeZone = opts.timeZone ?? "Asia/Seoul";

  const existing = await getEvent(opts.eventId, userId, profile);

  const eventComponent: Record<string, unknown> = {
    eventId: opts.eventId,
    summary: opts.summary ?? existing.summary,
    start: opts.start
      ? { dateTime: normalizeDateTime(opts.start), timeZone }
      : existing.start,
    end: opts.end
      ? { dateTime: normalizeDateTime(opts.end), timeZone }
      : existing.end,
  };
  if (opts.description !== undefined) eventComponent.description = opts.description;
  else if (existing.description) eventComponent.description = existing.description;
  if (opts.location !== undefined) eventComponent.location = opts.location;
  else if (existing.location) eventComponent.location = existing.location;
  if (opts.transparency !== undefined) eventComponent.transparency = opts.transparency;
  if (opts.visibility !== undefined) eventComponent.visibility = opts.visibility;
  if (opts.attendees !== undefined) {
    eventComponent.attendees = opts.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName ?? "",
      partstat: "NEEDS-ACTION",
      isOptional: false,
      isResource: false,
    }));
  } else if (existing.attendees) {
    eventComponent.attendees = existing.attendees;
  }

  const body = {
    eventComponents: [eventComponent],
    sendNotification: opts.sendNotification ?? false,
  };

  const url = `${BASE_URL}/users/${userId}/calendar/events/${opts.eventId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] PUT ${url}`);
    console.error(`[nworks] Body: ${JSON.stringify(body, null, 2)}`);
  }

  const res = await authedFetch(
    url,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    profile
  );

  if (!res.ok) return handleError(res);
}

export async function deleteEvent(
  eventId: string,
  userId = "me",
  sendNotification = false,
  profile = "default"
): Promise<void> {
  const params = new URLSearchParams();
  params.set("sendNotification", String(sendNotification));

  const url = `${BASE_URL}/users/${userId}/calendar/events/${eventId}?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] DELETE ${url}`);
  }

  const res = await authedFetch(url, { method: "DELETE" }, profile);

  if (res.status === 204) return;
  if (!res.ok) return handleError(res);
}
