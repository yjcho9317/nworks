import { AuthError } from "../utils/error.js";
import { loadCredentials, loadToken, saveToken } from "./config.js";
import { createJWT } from "./jwt.js";

const AUTH_URL = "https://auth.worksmobile.com/oauth2/v2.0/token";

export async function getValidToken(profile = "default"): Promise<string> {
  const cached = await loadToken(profile);

  if (cached && cached.expiresAt > Date.now() / 1000 + 300) {
    return cached.accessToken;
  }

  return refreshToken(profile);
}

export async function refreshToken(profile = "default"): Promise<string> {
  const creds = await loadCredentials(profile);
  const assertion = await createJWT(creds);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: process.env["NWORKS_SCOPE"] ?? "bot bot.read user.read",
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AuthError(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number | string;
  };

  const expiresIn = Number(data.expires_in);
  const tokenData = {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };

  await saveToken(tokenData, profile);
  return tokenData.accessToken;
}
