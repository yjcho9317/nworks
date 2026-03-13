import { Command } from "commander";
import * as directoryApi from "../api/directory.js";
import { output, errorOutput } from "../output/format.js";

const membersCommand = new Command("members")
  .description("List organization members (requires directory.read scope)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await directoryApi.listUsers(opts.profile as string);
      const formatted = {
        users: result.users.map((u) => ({
          userId: u.userId,
          userName: [u.userName?.lastName, u.userName?.firstName]
            .filter(Boolean)
            .join(" ") || "",
          email: u.email ?? "",
          cellPhone: (u as unknown as Record<string, unknown>).cellPhone as string ?? "",
          organization:
            u.organizations
              ?.find((o) => o.primary)?.organizationName ??
            u.organizations?.[0]?.organizationName ??
            "",
        })),
      };
      output(formatted, opts);
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

export const directoryCommand = new Command("directory")
  .description("Directory (organization) operations")
  .addCommand(membersCommand);
