import { Command } from "commander";
import { loadCredentials, loadToken, loadUserToken, clearCredentials } from "../auth/config.js";
import { revokeToken } from "../auth/oauth-user.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

export const logoutCommand = new Command("logout")
  .description("Remove stored credentials and tokens")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const profile = opts.profile as string;
      try {
        const creds = await loadCredentials(profile);
        const token = await loadToken(profile);
        const userToken = await loadUserToken(profile);
        if (token?.accessToken) {
          await revokeToken(token.accessToken, creds.clientId, creds.clientSecret);
        }
        if (userToken?.refreshToken) {
          await revokeToken(userToken.refreshToken, creds.clientId, creds.clientSecret);
        }
      } catch {
        // best-effort
      }
      await clearCredentials(profile);
      output({ success: true, message: `Logged out (profile: ${profile})` }, opts);
    } catch (err) {
      cliError(err, opts);
    }
  });
