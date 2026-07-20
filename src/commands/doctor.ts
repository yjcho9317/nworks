import { Command } from "commander";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { loadCredentials, loadToken, loadUserToken, hasServiceAccountCreds } from "../auth/config.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

interface CheckResult {
  check: string;
  status: string;
  detail: string;
}

// 시크릿 노출을 막기 위해 마지막 4자만 남기고 가린다.
function mask(value: string): string {
  return value.length <= 4 ? "****" : `****${value.slice(-4)}`;
}

async function runChecks(profile: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Credentials
  let creds;
  try {
    creds = await loadCredentials(profile);
    results.push({ check: "credentials", status: "OK", detail: `clientId: ${mask(creds.clientId)}` });
  } catch {
    results.push({ check: "credentials", status: "FAIL", detail: "No credentials found. CLI: run `nworks login --user`. MCP: use the nworks_setup tool (env NWORKS_CLIENT_SECRET required)." });
    return results;
  }

  // 2. Service Account
  if (hasServiceAccountCreds(creds)) {
    results.push({ check: "serviceAccount", status: "OK", detail: creds.serviceAccount });
  } else {
    results.push({ check: "serviceAccount", status: "SKIP", detail: "Not set (required for bot messaging)" });
  }

  // 3. Private Key file
  if (creds.privateKeyPath) {
    if (existsSync(creds.privateKeyPath)) {
      try {
        await readFile(creds.privateKeyPath, "utf-8");
        results.push({ check: "privateKey", status: "OK", detail: creds.privateKeyPath });
      } catch {
        results.push({ check: "privateKey", status: "FAIL", detail: `Cannot read: ${creds.privateKeyPath}` });
      }
    } else {
      results.push({ check: "privateKey", status: "FAIL", detail: `File not found: ${creds.privateKeyPath}` });
    }
  } else {
    results.push({ check: "privateKey", status: "SKIP", detail: "Not set" });
  }

  // 3-1. Private Key 위치 점검: 프로젝트/리포 디렉토리 안의 키는 에디터·AI 도구·npm pack에 노출될 위험.
  // 홈 디렉토리 키까지 오탐하지 않도록, 작업 디렉토리가 프로젝트(.git/package.json 존재)일 때만 경고한다.
  if (creds.privateKeyPath && existsSync(creds.privateKeyPath)) {
    const resolvedKey = resolve(creds.privateKeyPath);
    const cwd = resolve(process.cwd());
    const insideCwd = resolvedKey === cwd || resolvedKey.startsWith(cwd + sep);
    const looksLikeProject = existsSync(join(cwd, ".git")) || existsSync(join(cwd, "package.json"));
    if (insideCwd && looksLikeProject) {
      results.push({
        check: "keyLocation",
        status: "WARN",
        detail: "Private key is inside a project directory. Risk of exposure via editor plugins, AI tools, or `npm pack` — move it outside (e.g. your home directory) and update the path.",
      });
    }
  }

  // 4. Bot ID
  if (creds.botId) {
    results.push({ check: "botId", status: "OK", detail: creds.botId });
  } else {
    results.push({ check: "botId", status: "SKIP", detail: "Not set (required to send messages)" });
  }

  // 5. Service Account Token
  const token = await loadToken(profile);
  if (token) {
    const valid = token.expiresAt > Date.now() / 1000;
    results.push({
      check: "serviceToken",
      status: valid ? "OK" : "EXPIRED",
      detail: valid
        ? `expires: ${new Date(token.expiresAt * 1000).toISOString()}`
        : `expired: ${new Date(token.expiresAt * 1000).toISOString()}`,
    });
  } else {
    results.push({ check: "serviceToken", status: "SKIP", detail: "No token" });
  }

  // 6. User OAuth Token
  const userToken = await loadUserToken(profile);
  if (userToken) {
    const valid = userToken.expiresAt > Date.now() / 1000;
    results.push({
      check: "userOAuth",
      status: valid ? "OK" : "EXPIRED",
      detail: valid
        ? `scope: ${userToken.scope} | expires: ${new Date(userToken.expiresAt * 1000).toISOString()}`
        : `expired | scope: ${userToken.scope}`,
    });
  } else {
    results.push({ check: "userOAuth", status: "SKIP", detail: "No token. Run `nworks login --user`." });
  }

  // 7. API connectivity test
  if (hasServiceAccountCreds(creds) && token && token.expiresAt > Date.now() / 1000) {
    try {
      const res = await fetch("https://www.worksapis.com/v1.0/users/me", {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (res.ok) {
        results.push({ check: "apiConnection", status: "OK", detail: "Connected to NAVER WORKS API" });
      } else {
        results.push({ check: "apiConnection", status: "FAIL", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ check: "apiConnection", status: "FAIL", detail: `Connection failed: ${(e as Error).message}` });
    }
  } else if (userToken && userToken.expiresAt > Date.now() / 1000) {
    try {
      const res = await fetch("https://www.worksapis.com/v1.0/users/me", {
        headers: { Authorization: `Bearer ${userToken.accessToken}` },
      });
      if (res.ok) {
        results.push({ check: "apiConnection", status: "OK", detail: "Connected to NAVER WORKS API" });
      } else {
        results.push({ check: "apiConnection", status: "FAIL", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ check: "apiConnection", status: "FAIL", detail: `Connection failed: ${(e as Error).message}` });
    }
  } else {
    results.push({ check: "apiConnection", status: "SKIP", detail: "No valid token — skipping API test" });
  }

  return results;
}

export { runChecks };

export const doctorCommand = new Command("doctor")
  .description("Check nworks configuration and connectivity")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const results = await runChecks(opts.profile as string);

      if (opts.json || !process.stdout.isTTY) {
        output(results, opts);
      } else {
        console.log("\n  nworks doctor\n");
        for (const r of results) {
          const icon =
            r.status === "OK" ? "\u2705"
            : r.status === "SKIP" ? "\u2796"
            : r.status === "WARN" ? "\u26A0\uFE0F"
            : "\u274C";
          console.log(`  ${icon} ${r.check.padEnd(16)} ${r.detail}`);
        }
        console.log();
      }

      // \uC9C4\uB2E8 \uC911 \uD558\uB098\uB77C\uB3C4 FAIL\uC774\uBA74 \uC2A4\uD06C\uB9BD\uD2B8\u00B7CI\uC5D0\uC11C \uAC10\uC9C0\uD560 \uC218 \uC788\uB3C4\uB85D \uC885\uB8CC \uCF54\uB4DC\uB97C 1\uB85C \uC124\uC815\uD55C\uB2E4.
      if (results.some((r) => r.status === "FAIL")) {
        process.exitCode = 1;
      }
    } catch (err) {
      cliError(err, opts);
    }
  });
