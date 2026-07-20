import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { saveCredentials, saveUserToken, loadCredentials, loadUserToken, type Credentials } from "../auth/config.js";
import { refreshToken } from "../auth/token.js";
import { startUserOAuthFlow, buildAuthorizeUrl } from "../auth/oauth-user.js";
import { resolveScopes, mergeScopes } from "../auth/scopes.js";
import { output, errorOutput } from "../output/format.js";
import { randomBytes } from "node:crypto";

async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

// 시크릿 입력이 화면·스크롤백에 남지 않도록 에코를 끈 프롬프트.
// 질문은 직접 출력하고 readline의 출력(입력 에코 포함)은 전부 무음 처리한다.
async function promptSecret(question: string): Promise<string> {
  process.stdout.write(question);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  try {
    const answer = await rl.question("");
    process.stdout.write("\n"); // Enter 에코도 무음이므로 줄바꿈을 수동 출력
    return answer.trim();
  } finally {
    rl.close();
  }
}

export const loginCommand = new Command("login")
  .description("Authenticate with NAVER WORKS")
  .option("--user", "User OAuth login (opens browser)")
  .option("--preset <preset>", "Scope preset: readonly | default | all (default: all)")
  .option("--scope <scope>", "Advanced: raw space-separated scopes (overrides --preset)")
  .option("--client-id <id>", "Client ID")
  .option("--client-secret <secret>", "Client Secret")
  .option("--service-account <account>", "Service Account ID")
  .option("--private-key <path>", "Path to private key file (.key)")
  .option("--bot-id <id>", "Bot ID")
  .option("--domain-id <id>", "Domain ID (optional)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const profile = opts.profile as string;

      if (opts.user) {
        await handleUserLogin(profile, opts);
      } else {
        await handleServiceAccountLogin(opts);
      }
    } catch (err) {
      const error = err as Error;
      errorOutput({ message: error.message }, opts);
      process.exitCode = 1;
    }
  });

async function handleUserLogin(
  profile: string,
  opts: Record<string, unknown>
): Promise<void> {
  let clientId = opts.clientId as string | undefined;
  let clientSecret = opts.clientSecret as string | undefined;

  try {
    const existing = await loadCredentials(profile);
    if (!clientId) clientId = existing.clientId;
    if (!clientSecret) clientSecret = existing.clientSecret;
  } catch {
    // ignore
  }

  if (process.stdin.isTTY) {
    if (!clientId) clientId = await prompt("Client ID: ");
    if (!clientSecret) clientSecret = await promptSecret("Client Secret: ");
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      "Client ID and Client Secret are required for User OAuth.\n" +
      "Use --client-id and --client-secret flags, or set NWORKS_CLIENT_ID / NWORKS_CLIENT_SECRET env vars."
    );
  }

  try {
    const existing = await loadCredentials(profile);
    await saveCredentials({ ...existing, clientId, clientSecret }, profile);
  } catch {
    await saveCredentials({ clientId, clientSecret }, profile);
  }

  // 기존 토큰의 scope와 합쳐 재로그인 시 권한이 줄지 않게 한다(MCP login_user와 동일 정책).
  const requestedScopes = resolveScopes((opts.preset as string | undefined) ?? (opts.scope as string | undefined));
  let existingScopes: string[] = [];
  try {
    const existingToken = await loadUserToken(profile);
    existingScopes = existingToken?.scope?.split(" ").filter(Boolean) ?? [];
  } catch {
    // 기존 토큰 없음 — 무시
  }
  const mergedScope = mergeScopes(existingScopes, requestedScopes);

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(clientId, mergedScope, state);

  console.error(`\nOpening browser for NAVER WORKS login...`);
  console.error(`If the browser does not open, visit this URL:\n`);
  console.error(`  ${authorizeUrl}\n`);

  // execFile로 URL을 셸 문자열이 아닌 인자로 전달해 셸 인젝션 여지를 없앤다.
  const { execFile } = await import("node:child_process");
  if (process.platform === "darwin") {
    execFile("open", [authorizeUrl]);
  } else if (process.platform === "win32") {
    // Windows의 start는 cmd 내장 명령이라 cmd /c로 실행한다. 빈 "" 는 start의 title 인자.
    execFile("cmd", ["/c", "start", "", authorizeUrl]);
  } else {
    execFile("xdg-open", [authorizeUrl]);
  }

  const tokenData = await startUserOAuthFlow(mergedScope, profile, state);
  await saveUserToken(tokenData, profile);

  output(
    {
      success: true,
      message: "User OAuth login successful",
      scope: tokenData.scope,
      profile,
    },
    opts
  );
}

async function handleServiceAccountLogin(
  opts: Record<string, unknown>
): Promise<void> {
  let clientId = opts.clientId as string | undefined;
  let clientSecret = opts.clientSecret as string | undefined;
  let serviceAccount = opts.serviceAccount as string | undefined;
  let privateKeyPath = opts.privateKey as string | undefined;
  let botId = opts.botId as string | undefined;
  const domainId = opts.domainId as string | undefined;
  const profile = opts.profile as string;

  if (!clientId) clientId = process.env["NWORKS_CLIENT_ID"];
  if (!clientSecret) clientSecret = process.env["NWORKS_CLIENT_SECRET"];
  if (!serviceAccount) serviceAccount = process.env["NWORKS_SERVICE_ACCOUNT"];
  if (!privateKeyPath) privateKeyPath = process.env["NWORKS_PRIVATE_KEY_PATH"];
  if (!botId) botId = process.env["NWORKS_BOT_ID"];

  if (process.stdin.isTTY) {
    if (!clientId) clientId = await prompt("Client ID: ");
    if (!clientSecret) clientSecret = await promptSecret("Client Secret: ");
    if (!serviceAccount)
      serviceAccount = await prompt("Service Account: ");
    if (!privateKeyPath)
      privateKeyPath = await prompt("Private Key Path: ");
    if (!botId) botId = await prompt("Bot ID: ");
  }

  if (!clientId || !clientSecret || !serviceAccount || !privateKeyPath || !botId) {
    throw new Error(
      "Missing required fields. Use flags, environment variables, or run interactively."
    );
  }

  if (!existsSync(privateKeyPath)) {
    throw new Error(`Private key file not found: ${privateKeyPath}`);
  }

  await readFile(privateKeyPath, "utf-8");

  const creds: Credentials = {
    clientId,
    clientSecret,
    serviceAccount,
    privateKeyPath,
    botId,
    domainId,
  };

  await saveCredentials(creds, profile);

  await refreshToken(profile);

  output(
    { success: true, message: `Logged in as ${serviceAccount}`, profile },
    opts
  );
}
