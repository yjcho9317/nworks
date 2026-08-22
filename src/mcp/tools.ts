import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSetupTools } from "./tools/setup.js";
import { registerMessageTools } from "./tools/message.js";
import { registerDirectoryTools } from "./tools/directory.js";
import { registerCalendarTools } from "./tools/calendar.js";
import { registerDriveTools } from "./tools/drive.js";
import { registerMailTools } from "./tools/mail.js";
import { registerTaskTools } from "./tools/task.js";
import { registerBoardTools } from "./tools/board.js";
import { registerContactTools } from "./tools/contact.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerDiagnosticsTools } from "./tools/diagnostics.js";

// 도구 정의는 도메인별 파일로 분리돼 있다. 여기서는 등록만 조립한다.
export function registerTools(server: McpServer): void {
  registerSetupTools(server);
  registerMessageTools(server);
  registerDirectoryTools(server);
  registerCalendarTools(server);
  registerDriveTools(server);
  registerMailTools(server);
  registerTaskTools(server);
  registerBoardTools(server);
  registerContactTools(server);
  registerAuthTools(server);
  registerDiagnosticsTools(server);
}
