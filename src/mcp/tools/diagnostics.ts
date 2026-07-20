import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runChecks } from "../../commands/doctor.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerDiagnosticsTools(server: McpServer): void {
  // Tool 25: 진단
  defineTool(server,
    "nworks_doctor",
    "NAVER WORKS 연결 상태를 진단합니다. 인증 정보, 토큰, Private Key, API 연결을 점검합니다.",
    {},
    async () => {
      try {
        const results = await runChecks("default");
        const maskedResults = results.map((r) => {
          if (r.check === "credentials" && r.status === "OK") {
            return { ...r, detail: r.detail.replace(/clientId: .+/, "clientId: ****") };
          }
          if (r.check === "privateKey" && r.status === "OK") {
            return { ...r, detail: "OK (path hidden)" };
          }
          if (r.check === "serviceAccount" && r.status === "OK") {
            const masked = r.detail.length <= 4 ? "****" : `****${r.detail.slice(-4)}`;
            return { ...r, detail: masked };
          }
          return r;
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(maskedResults) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );
}
