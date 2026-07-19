import { Command } from "commander";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startMcpServer } from "../mcp/server.js";
import { registerTools } from "../mcp/tools.js";

// McpServer는 등록된 도구를 공개 API로 노출하지 않아 내부 저장소(_registeredTools)에서 읽는다.
interface RegisteredTool {
  description?: string;
}

function listRegisteredTools(): { name: string; summary: string }[] {
  const server = new McpServer({ name: "nworks", version: "0.0.0" });
  registerTools(server);

  const registered = (server as unknown as {
    _registeredTools: Record<string, RegisteredTool>;
  })._registeredTools;

  return Object.entries(registered).map(([name, tool]) => ({
    name,
    summary: (tool.description ?? "").split("\n")[0]?.trim() ?? "",
  }));
}

export const mcpCommand = new Command("mcp")
  .description("Start MCP server (stdio transport)")
  .option("--list-tools", "List available MCP tools")
  .action(async (opts) => {
    if (opts.listTools) {
      const tools = listRegisteredTools();
      const width = tools.length ? Math.max(...tools.map((t) => t.name.length)) : 0;
      for (const { name, summary } of tools) {
        console.log(`${name.padEnd(width)}  ${summary}`);
      }
      console.log(`\n${tools.length} tools`);
      return;
    }

    await startMcpServer();
  });
