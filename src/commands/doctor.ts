import { Command } from "commander";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { loadCredentials, loadToken, loadUserToken, hasServiceAccountCreds } from "../auth/config.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

interface CheckResult {
  check: string;
  status: string;
  detail: string;
}

async function runChecks(profile: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Credentials
  let creds;
  try {
    creds = await loadCredentials(profile);
    results.push({ check: "credentials", status: "OK", detail: `clientId: ${creds.clientId}` });
  } catch {
    results.push({ check: "credentials", status: "FAIL", detail: "인증 정보 없음. CLI: `nworks login --user` / MCP: nworks_setup tool 사용 (환경변수 NWORKS_CLIENT_SECRET 필요)" });
    return results;
  }

  // 2. Service Account
  if (hasServiceAccountCreds(creds)) {
    results.push({ check: "serviceAccount", status: "OK", detail: creds.serviceAccount });
  } else {
    results.push({ check: "serviceAccount", status: "SKIP", detail: "미설정 (봇 메시지 사용 시 필요)" });
  }

  // 3. Private Key file
  if (creds.privateKeyPath) {
    if (existsSync(creds.privateKeyPath)) {
      try {
        await readFile(creds.privateKeyPath, "utf-8");
        results.push({ check: "privateKey", status: "OK", detail: creds.privateKeyPath });
      } catch {
        results.push({ check: "privateKey", status: "FAIL", detail: `읽기 불가: ${creds.privateKeyPath}` });
      }
    } else {
      results.push({ check: "privateKey", status: "FAIL", detail: `파일 없음: ${creds.privateKeyPath}` });
    }
  } else {
    results.push({ check: "privateKey", status: "SKIP", detail: "미설정" });
  }

  // 4. Bot ID
  if (creds.botId) {
    results.push({ check: "botId", status: "OK", detail: creds.botId });
  } else {
    results.push({ check: "botId", status: "SKIP", detail: "미설정 (메시지 전송 시 필요)" });
  }

  // 5. Service Account Token
  const token = await loadToken(profile);
  if (token) {
    const valid = token.expiresAt > Date.now() / 1000;
    results.push({
      check: "serviceToken",
      status: valid ? "OK" : "EXPIRED",
      detail: valid
        ? `만료: ${new Date(token.expiresAt * 1000).toISOString()}`
        : `만료됨: ${new Date(token.expiresAt * 1000).toISOString()}`,
    });
  } else {
    results.push({ check: "serviceToken", status: "SKIP", detail: "토큰 없음" });
  }

  // 6. User OAuth Token
  const userToken = await loadUserToken(profile);
  if (userToken) {
    const valid = userToken.expiresAt > Date.now() / 1000;
    results.push({
      check: "userOAuth",
      status: valid ? "OK" : "EXPIRED",
      detail: valid
        ? `scope: ${userToken.scope} | 만료: ${new Date(userToken.expiresAt * 1000).toISOString()}`
        : `만료됨 | scope: ${userToken.scope}`,
    });
  } else {
    results.push({ check: "userOAuth", status: "SKIP", detail: "토큰 없음. `nworks login --user` 필요" });
  }

  // 7. API connectivity test
  if (hasServiceAccountCreds(creds) && token && token.expiresAt > Date.now() / 1000) {
    try {
      const res = await fetch("https://www.worksapis.com/v1.0/users/me", {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (res.ok) {
        results.push({ check: "apiConnection", status: "OK", detail: "NAVER WORKS API 연결 성공" });
      } else {
        results.push({ check: "apiConnection", status: "FAIL", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ check: "apiConnection", status: "FAIL", detail: `연결 실패: ${(e as Error).message}` });
    }
  } else if (userToken && userToken.expiresAt > Date.now() / 1000) {
    try {
      const res = await fetch("https://www.worksapis.com/v1.0/users/me", {
        headers: { Authorization: `Bearer ${userToken.accessToken}` },
      });
      if (res.ok) {
        results.push({ check: "apiConnection", status: "OK", detail: "NAVER WORKS API 연결 성공" });
      } else {
        results.push({ check: "apiConnection", status: "FAIL", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ check: "apiConnection", status: "FAIL", detail: `연결 실패: ${(e as Error).message}` });
    }
  } else {
    results.push({ check: "apiConnection", status: "SKIP", detail: "유효한 토큰 없음 — API 테스트 건너뜀" });
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
          const icon = r.status === "OK" ? "\u2705" : r.status === "SKIP" ? "\u2796" : "\u274C";
          console.log(`  ${icon} ${r.check.padEnd(16)} ${r.detail}`);
        }
        console.log();
      }
    } catch (err) {
      cliError(err, opts);
    }
  });
