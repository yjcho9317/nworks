import { readFile, writeFile, mkdir, chmod, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
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

const IS_UNIX = process.platform !== "win32";
const CONFIG_DIR = join(homedir(), ".config", "nworks");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");
const USER_TOKEN_PATH = join(CONFIG_DIR, "user-token.json");

// 프로필명은 credentials/token JSON의 오브젝트 키로 쓰인다.
// 화이트리스트로 제한해 __proto__/constructor 등 프로토타입 오염 키를 차단한다.
const PROFILE_NAME_PATTERN = /^[\w.-]+$/;
const FORBIDDEN_PROFILE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
// ".", "..", "..." 처럼 점으로만 된 이름은 파일시스템상 특수 의미가 있고 프로필로도 무의미하므로 거부한다.
const DOTS_ONLY = /^\.+$/;

function validateProfileName(profile: string): void {
  if (
    !PROFILE_NAME_PATTERN.test(profile) ||
    FORBIDDEN_PROFILE_KEYS.has(profile) ||
    DOTS_ONLY.test(profile)
  ) {
    throw new AuthError(
      `Invalid profile name "${profile}". Use only letters, digits, ".", "_", or "-" (and not "." / ".." alone).`
    );
  }
}

// passthrough: 알 수 없는 필드는 보존해 기존 사용자 파일이 거부되지 않도록 한다.
const credentialsSchema = z
  .object({
    clientId: z.string(),
    clientSecret: z.string(),
    serviceAccount: z.string().optional(),
    privateKeyPath: z.string().optional(),
    botId: z.string().optional(),
    domainId: z.string().optional(),
  })
  .passthrough();

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true, ...(IS_UNIX && { mode: 0o700 }) });
  } else if (IS_UNIX) {
    // 기존 디렉토리는 mkdir mode가 적용되지 않으므로 권한을 명시적으로 재적용한다.
    await chmod(CONFIG_DIR, 0o700);
  }
}

// 같은 프로세스가 같은 파일(token.json은 모든 프로필이 공유)에 동시에 쓸 때
// 임시 파일 경로가 충돌하지 않도록 프로세스 내 카운터로 유일하게 만든다.
let tempFileCounter = 0;

// 임시 파일에 기록 후 rename으로 교체해 원자적으로 저장한다.
// 저장 도중 프로세스가 죽어도 대상 파일이 부분 기록되지 않는다(토큰 손상 방지).
// writeFile의 mode 옵션은 신규 생성 시에만 적용되므로 chmod로 권한을 확실히 교정한다(Unix 한정).
async function writeSecureFile(path: string, data: string): Promise<void> {
  const tempPath = `${path}.${process.pid}.${tempFileCounter++}.tmp`;
  await writeFile(tempPath, data, { encoding: "utf-8", ...(IS_UNIX && { mode: 0o600 }) });
  if (IS_UNIX) {
    await chmod(tempPath, 0o600);
  }
  await rename(tempPath, path);
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

  validateProfileName(profile);

  if (!existsSync(CREDENTIALS_PATH)) {
    throw new AuthError(
      "Not logged in. Run `nworks login` or set environment variables."
    );
  }

  const raw = await readFile(CREDENTIALS_PATH, "utf-8");
  const profiles = JSON.parse(raw) as Record<string, unknown>;
  const creds = profiles[profile];

  if (!creds) {
    throw new AuthError(`Profile "${profile}" not found in credentials.`);
  }

  const parsed = credentialsSchema.safeParse(creds);
  if (!parsed.success) {
    throw new AuthError(
      `Credentials for profile "${profile}" are malformed. Run \`nworks login\` to reconfigure.`
    );
  }

  return parsed.data;
}

export async function saveCredentials(
  creds: Credentials,
  profile = "default"
): Promise<void> {
  validateProfileName(profile);
  await ensureConfigDir();

  let profiles: Record<string, Credentials> = {};
  if (existsSync(CREDENTIALS_PATH)) {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    profiles = JSON.parse(raw) as Record<string, Credentials>;
  }

  profiles[profile] = creds;
  await writeSecureFile(CREDENTIALS_PATH, JSON.stringify(profiles, null, 2));
}

export async function loadToken(profile = "default"): Promise<TokenData | null> {
  validateProfileName(profile);
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
  validateProfileName(profile);
  await ensureConfigDir();

  let tokens: Record<string, TokenData> = {};
  if (existsSync(TOKEN_PATH)) {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    tokens = JSON.parse(raw) as Record<string, TokenData>;
  }

  tokens[profile] = token;
  await writeSecureFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export async function loadUserToken(profile = "default"): Promise<UserTokenData | null> {
  validateProfileName(profile);
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
  validateProfileName(profile);
  await ensureConfigDir();

  let tokens: Record<string, UserTokenData> = {};
  if (existsSync(USER_TOKEN_PATH)) {
    const raw = await readFile(USER_TOKEN_PATH, "utf-8");
    tokens = JSON.parse(raw) as Record<string, UserTokenData>;
  }

  tokens[profile] = token;
  await writeSecureFile(USER_TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export async function clearCredentials(profile = "default"): Promise<void> {
  validateProfileName(profile);

  if (existsSync(CREDENTIALS_PATH)) {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    const profiles = JSON.parse(raw) as Record<string, Credentials>;
    delete profiles[profile];
    await writeSecureFile(CREDENTIALS_PATH, JSON.stringify(profiles, null, 2));
  }

  if (existsSync(TOKEN_PATH)) {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(raw) as Record<string, TokenData>;
    delete tokens[profile];
    await writeSecureFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }

  if (existsSync(USER_TOKEN_PATH)) {
    const raw = await readFile(USER_TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(raw) as Record<string, UserTokenData>;
    delete tokens[profile];
    await writeSecureFile(USER_TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }
}
