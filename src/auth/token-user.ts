import { AuthError } from "../utils/error.js";
import { loadUserToken, saveUserToken } from "./config.js";
import { refreshUserToken } from "./oauth-user.js";

export async function getValidUserToken(profile = "default"): Promise<string> {
  const cached = await loadUserToken(profile);

  if (!cached) {
    throw new AuthError(
      "User OAuth token not found. Run `nworks login --user` first."
    );
  }

  if (cached.expiresAt > Date.now() / 1000 + 300) {
    return cached.accessToken;
  }

  const refreshed = await refreshUserToken(cached.refreshToken, profile);
  await saveUserToken(refreshed, profile);
  return refreshed.accessToken;
}
