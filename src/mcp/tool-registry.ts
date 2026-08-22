import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  nworks_setup: { title: "Save credentials", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  nworks_message_send: { title: "Send message", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_message_members: { title: "List channel members", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_directory_members: { title: "List organization members", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_calendar_list: { title: "List calendar events", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_calendar_create: { title: "Create calendar event", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_calendar_update: { title: "Update calendar event", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_calendar_delete: { title: "Delete calendar event", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_drive_list: { title: "List drive files", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_drive_upload: { title: "Upload file to drive", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  // download는 outputDir 지정 시 로컬 파일을 쓰므로 순수 읽기가 아니다(readOnlyHint=false).
  nworks_drive_download: { title: "Download drive file", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  nworks_sharedrive_list: { title: "List shared drives", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_sharedrive_files: { title: "List shared drive files", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_sharedrive_download: { title: "Download shared drive file", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  nworks_mail_send: { title: "Send mail", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_mail_list: { title: "List mail", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_mail_read: { title: "Read mail", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  // drive_download와 같은 이유로 outputDir 지정 시 로컬 파일을 쓴다(readOnlyHint=false).
  nworks_mail_download_attachment: { title: "Download mail attachment", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  nworks_task_list: { title: "List tasks", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_task_create: { title: "Create task", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_task_update: { title: "Update task", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_task_delete: { title: "Delete task", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_board_list: { title: "List boards", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_board_posts: { title: "List board posts", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_board_read: { title: "Read board post", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_board_create: { title: "Create board post", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_contact_list: { title: "List contacts", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_contact_get: { title: "Get contact", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_contact_create: { title: "Create contact", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_contact_update: { title: "Update contact", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_contact_delete: { title: "Delete contact", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_contact_list_tags: { title: "List contact tags", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_login_user: { title: "Log in with User OAuth", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  nworks_whoami: { title: "Show auth status", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  nworks_logout: { title: "Log out", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  nworks_doctor: { title: "Diagnose connection", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

// deprecated된 server.tool 대신 registerTool로 등록하며 위 annotations를 자동 부착한다.
// 도구별 핸들러는 그대로 두고 등록 경로만 통일한다.
export function defineTool<Args extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Args,
  handler: ToolCallback<Args>
): void {
  const annotations = TOOL_ANNOTATIONS[name];
  server.registerTool(
    name,
    { description, inputSchema, ...(annotations ? { annotations } : {}) },
    handler
  );
}
