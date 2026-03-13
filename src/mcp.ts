import { startMcpServer } from "./mcp/server.js";

startMcpServer().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
