import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { loadCredentials, loadUserToken } from "../auth/config.js";

export async function startMcpServer(): Promise<void> {
  // 인증 상태 확인 (경고만, 서버는 항상 시작)
  try {
    await loadCredentials();
  } catch {
    console.error(
      "[nworks] Authentication required. Run: nworks login"
    );
  }

  try {
    const userToken = await loadUserToken();
    if (!userToken) {
      console.error(
        "[nworks] User OAuth not configured. Run: nworks login --user"
      );
    }
  } catch {
    // ignore
  }

  const server = new McpServer({
    name: "nworks",
    version: "1.0.0",
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
