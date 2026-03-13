import { createRequire } from "node:module";
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { messageCommand } from "./commands/message.js";
import { directoryCommand } from "./commands/directory.js";
import { calendarCommand } from "./commands/calendar.js";
import { driveCommand } from "./commands/drive.js";
import { mailCommand } from "./commands/mail.js";
import { taskCommand } from "./commands/task.js";
import { boardCommand } from "./commands/board.js";
import { mcpCommand } from "./commands/mcp-cmd.js";
import { doctorCommand } from "./commands/doctor.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command()
  .name("nworks")
  .description("NAVER WORKS CLI — built for humans and AI agents")
  .version(version)
  .option("--json", "Always output JSON")
  .option("-v, --verbose", "Debug logging")
  .option("--dry-run", "Print request without calling API")
  .option("-p, --profile <name>", "Profile name", "default");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(messageCommand);
program.addCommand(directoryCommand);
program.addCommand(calendarCommand);
program.addCommand(driveCommand);
program.addCommand(mailCommand);
program.addCommand(taskCommand);
program.addCommand(boardCommand);
program.addCommand(mcpCommand);
program.addCommand(doctorCommand);

program.parse();
