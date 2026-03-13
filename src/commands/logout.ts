import { Command } from "commander";
import { clearCredentials } from "../auth/config.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

export const logoutCommand = new Command("logout")
  .description("Remove stored credentials and tokens")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const profile = opts.profile as string;
      await clearCredentials(profile);
      output({ success: true, message: `Logged out (profile: ${profile})` }, opts);
    } catch (err) {
      cliError(err, opts);
    }
  });
