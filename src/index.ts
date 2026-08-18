import { Command } from "commander";
import { VERSION } from "./version.js";
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
import { contactCommand } from "./commands/contact.js";
import { mcpCommand } from "./commands/mcp-cmd.js";
import { doctorCommand } from "./commands/doctor.js";

const program = new Command()
  .name("nworks")
  .description("NAVER WORKS CLI — built for humans and AI agents")
  .version(VERSION);
// 전역 옵션을 두지 않는다. --json/--profile은 각 서브커맨드가 자체 정의하며,
// 전역과 같은 이름을 겹쳐 두면 commander가 서브커맨드 값을 무시하고 전역 기본값을 쓴다.
// (--verbose/--dry-run은 실동작이 없던 죽은 옵션이라 함께 제거)

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
program.addCommand(contactCommand);
program.addCommand(mcpCommand);
program.addCommand(doctorCommand);

program.parse();
