import { readFile, stat } from "node:fs/promises";
import jwt from "jsonwebtoken";
import type { Credentials } from "./config.js";
import { AuthError } from "../utils/error.js";

export async function createJWT(creds: Credentials): Promise<string> {
  if (!creds.serviceAccount || !creds.privateKeyPath) {
    throw new AuthError(
      "Service Account credentials required for bot authentication.\n" +
      "Run `nworks login` with --service-account and --private-key flags."
    );
  }

  const privateKey = await readFile(creds.privateKeyPath, "utf-8");

  if (process.platform !== "win32") {
    const fileStat = await stat(creds.privateKeyPath);
    const mode = fileStat.mode & 0o777;
    if (mode & 0o077) {
      console.error(
        `[nworks] Warning: Private key file has permissions ${mode.toString(8)}. Recommended: 600`
      );
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: creds.clientId,
    sub: creds.serviceAccount,
    iat: now,
    exp: now + 3600,
  };

  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}
