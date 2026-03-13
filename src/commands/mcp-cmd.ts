import { Command } from "commander";
import { startMcpServer } from "../mcp/server.js";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server (stdio transport)")
  .option("--list-tools", "List available MCP tools")
  .action(async (opts) => {
    if (opts.listTools) {
      console.log("nworks_message_send     — Send message to user or channel");
      console.log("nworks_message_members  — List channel members");
      console.log("nworks_directory_members — List organization members");
      console.log("nworks_calendar_list    — List calendar events (User OAuth)");
      console.log("nworks_whoami           — Show auth status");
      return;
    }

    await startMcpServer();
  });
