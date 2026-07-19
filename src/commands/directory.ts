import { Command } from "commander";
import * as directoryApi from "../api/directory.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

const membersCommand = new Command("members")
  .description("List organization members (requires directory.read scope)")
  .option("--count <n>", "Items per page (default: 100)")
  .option("--cursor <cursor>", "Pagination cursor from a previous response")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const count = opts.count ? Number(opts.count) : 100;
      const result = await directoryApi.listUsers(count, opts.cursor as string | undefined, opts.profile as string);
      const formatted = {
        nextCursor: result.responseMetaData?.nextCursor ?? null,
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
      cliError(err, opts);
    }
  });

export const directoryCommand = new Command("directory")
  .description("Directory (organization) operations")
  .addCommand(membersCommand);
