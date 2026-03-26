import { request } from "./client.js";
import { loadCredentials } from "../auth/config.js";
import { sanitizePathSegment } from "../utils/sanitize.js";

export type MessageType = "text" | "button" | "list";

export interface SendOptions {
  to?: string;
  channel?: string;
  text: string;
  type?: MessageType;
  actions?: string;
  elements?: string;
  profile?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
}

export interface MemberListResult {
  members: string[];
  responseMetaData?: { nextCursor?: string };
}

function buildContent(opts: SendOptions): Record<string, unknown> {
  const type = opts.type ?? "text";

  if (type === "text") {
    return { type: "text", text: opts.text };
  }

  if (type === "button") {
    const actions = opts.actions ? (() => {
      const parsed: unknown = JSON.parse(opts.actions!);
      if (!Array.isArray(parsed)) throw new Error("actions must be a JSON array");
      return parsed as unknown[];
    })() : [];
    return {
      type: "button_template",
      contentText: opts.text,
      actions,
    };
  }

  if (type === "list") {
    const elements = opts.elements ? (() => {
      const parsed: unknown = JSON.parse(opts.elements!);
      if (!Array.isArray(parsed)) throw new Error("elements must be a JSON array");
      return parsed as unknown[];
    })() : [];
    return {
      type: "list_template",
      coverData: { text: opts.text },
      elements,
    };
  }

  return { type: "text", text: opts.text };
}

export async function send(opts: SendOptions): Promise<SendResult> {
  const profile = opts.profile ?? "default";
  const creds = await loadCredentials(profile);

  if (!creds.botId) {
    throw new Error(
      "Bot ID is required for sending messages.\n" +
      "Run `nworks login` with --bot-id flag to set up bot credentials."
    );
  }

  const content = buildContent(opts);
  const body = { content };

  if (opts.to) {
    const result = await request<{ messageId?: string }>({
      method: "POST",
      path: `/bots/${sanitizePathSegment(creds.botId)}/users/${sanitizePathSegment(opts.to)}/messages`,
      body,
      profile,
    });
    return { success: true, messageId: result?.messageId };
  }
  if (opts.channel) {
    const result = await request<{ messageId?: string }>({
      method: "POST",
      path: `/bots/${sanitizePathSegment(creds.botId)}/channels/${sanitizePathSegment(opts.channel)}/messages`,
      body,
      profile,
    });
    return { success: true, messageId: result?.messageId };
  }

  throw new Error("Either --to (userId) or --channel (channelId) is required.");
}


export async function listMembers(
  channelId: string,
  profile = "default"
): Promise<MemberListResult> {
  const creds = await loadCredentials(profile);

  if (!creds.botId) {
    throw new Error(
      "Bot ID is required for listing channel members.\n" +
      "Run `nworks login` with --bot-id flag to set up bot credentials."
    );
  }

  const result = await request<{ members: string[]; responseMetaData?: { nextCursor?: string } }>({
    method: "GET",
    path: `/bots/${sanitizePathSegment(creds.botId)}/channels/${sanitizePathSegment(channelId)}/members`,
    profile,
  });
  return { members: result.members ?? [], responseMetaData: result.responseMetaData };
}
