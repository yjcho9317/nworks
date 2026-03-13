import { Command } from "commander";
import { loadCredentials, loadToken } from "../auth/config.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

export const whoamiCommand = new Command("whoami")
  .description("Show current authentication status")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const profile = opts.profile as string;
      const creds = await loadCredentials(profile);
      const token = await loadToken(profile);

      const expiresAt = token ? token.expiresAt : null;
      const isValid =
        typeof expiresAt === "number" && !isNaN(expiresAt)
          ? expiresAt > Date.now() / 1000
          : false;

      let tokenExpiresAt = "(no token)";
      if (typeof expiresAt === "number" && !isNaN(expiresAt) && expiresAt > 0) {
        tokenExpiresAt = new Date(expiresAt * 1000).toISOString();
      }

      output(
        {
          profile,
          serviceAccount: creds.serviceAccount ?? "(not set)",
          clientId: creds.clientId,
          botId: creds.botId ?? "(not set)",
          domainId: creds.domainId ?? "(not set)",
          tokenValid: isValid,
          tokenExpiresAt,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts);
    }
  });
