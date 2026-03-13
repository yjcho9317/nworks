import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AuthError } from "../utils/error.js";

export interface Credentials {
  clientId: string;
  clientSecret: string;
  serviceAccount?: string;
  privateKeyPath?: string;
  botId?: string;
  domainId?: string;
}

export function hasServiceAccountCreds(
  creds: Credentials
): creds is Credentials & Required<Pick<Credentials, "serviceAccount" | "privateKeyPath" | "botId">> {
  return !!(creds.serviceAccount && creds.privateKeyPath && creds.botId);
}

export interface TokenData {
  accessToken: string;
  expiresAt: number;
}

export interface UserTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

const CONFIG_DIR = join(homedir(), ".config", "nworks");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");
const USER_TOKEN_PATH = join(CONFIG_DIR, "user-token.json");

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export function getCredentialsFromEnv(): Credentials | null {
  const clientId = process.env["NWORKS_CLIENT_ID"];
  const clientSecret = process.env["NWORKS_CLIENT_SECRET"];

  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    serviceAccount: process.env["NWORKS_SERVICE_ACCOUNT"],
    privateKeyPath: process.env["NWORKS_PRIVATE_KEY_PATH"],
    botId: process.env["NWORKS_BOT_ID"],
    domainId: process.env["NWORKS_DOMAIN_ID"],
  };
}

export async function loadCredentials(
  profile = "default"
): Promise<Credentials> {
  const envCreds = getCredentialsFromEnv();
  if (envCreds) return envCreds;

  if (!existsSync(CREDENTIALS_PATH)) {
    throw new AuthError(
      "Not logged in. Run `nworks login` or set environment variables."
    );
  }

  const raw = await readFile(CREDENTIALS_PATH, "utf-8");
  const profiles = JSON.parse(raw) as Record<string, Credentials>;
  const creds = profiles[profile];

  if (!creds) {
    throw new AuthError(`Profile "${profile}" not found in credentials.`);
  }

  return creds;
}

export async function saveCredentials(
  creds: Credentials,
  profile = "default"
): Promise<void> {
  await ensureConfigDir();

  let profiles: Record<string, Credentials> = {};
  if (existsSync(CREDENTIALS_PATH)) {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    profiles = JSON.parse(raw) as Record<string, Credentials>;
  }

  profiles[profile] = creds;
  await writeFile(CREDENTIALS_PATH, JSON.stringify(profiles, null, 2), "utf-8");
}

export async function loadToken(profile = "default"): Promise<TokenData | null> {
  if (!existsSync(TOKEN_PATH)) return null;

  const raw = await readFile(TOKEN_PATH, "utf-8");
  const tokens = JSON.parse(raw) as Record<string, unknown>;
  const entry = tokens[profile] as Record<string, unknown> | undefined;
  if (!entry) return null;

  return {
    accessToken: String(entry["accessToken"]),
    expiresAt: Number(entry["expiresAt"]),
  };
}

export async function saveToken(
  token: TokenData,
  profile = "default"
): Promise<void> {
  await ensureConfigDir();

  let tokens: Record<string, TokenData> = {};
  if (existsSync(TOKEN_PATH)) {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    tokens = JSON.parse(raw) as Record<string, TokenData>;
  }

  tokens[profile] = token;
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function loadUserToken(profile = "default"): Promise<UserTokenData | null> {
  if (!existsSync(USER_TOKEN_PATH)) return null;

  const raw = await readFile(USER_TOKEN_PATH, "utf-8");
  const tokens = JSON.parse(raw) as Record<string, unknown>;
  const entry = tokens[profile] as Record<string, unknown> | undefined;
  if (!entry) return null;

  return {
    accessToken: String(entry["accessToken"]),
    refreshToken: String(entry["refreshToken"]),
    expiresAt: Number(entry["expiresAt"]),
    scope: String(entry["scope"] ?? ""),
  };
}

export async function saveUserToken(
  token: UserTokenData,
  profile = "default"
): Promise<void> {
  await ensureConfigDir();

  let tokens: Record<string, UserTokenData> = {};
  if (existsSync(USER_TOKEN_PATH)) {
    const raw = await readFile(USER_TOKEN_PATH, "utf-8");
    tokens = JSON.parse(raw) as Record<string, UserTokenData>;
  }

  tokens[profile] = token;
  await writeFile(USER_TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function clearCredentials(profile = "default"): Promise<void> {
  if (existsSync(CREDENTIALS_PATH)) {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    const profiles = JSON.parse(raw) as Record<string, Credentials>;
    delete profiles[profile];
    await writeFile(
      CREDENTIALS_PATH,
      JSON.stringify(profiles, null, 2),
      "utf-8"
    );
  }

  if (existsSync(TOKEN_PATH)) {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(raw) as Record<string, TokenData>;
    delete tokens[profile];
    await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
  }

  if (existsSync(USER_TOKEN_PATH)) {
    const raw = await readFile(USER_TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(raw) as Record<string, UserTokenData>;
    delete tokens[profile];
    await writeFile(USER_TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
  }
}
