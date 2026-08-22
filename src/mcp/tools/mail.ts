import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as mailApi from "../../api/mail.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { validateLocalPath, sanitizeFileName } from "../../utils/sanitize.js";
import { defineTool } from "../tool-registry.js";

export function registerMailTools(server: McpServer): void {
  // Tool 11: 메일 전송
  defineTool(server,
    "nworks_mail_send",
    "NAVER WORKS 메일을 전송합니다. '메일 보내줘', '이메일 작성해줘' 등의 요청에 사용. 비동기 전송(성공 시 202). User OAuth 인증 필요 (mail scope)",
    {
      to: z.string().describe("수신자 이메일 (여러 명은 ; 로 구분)"),
      subject: z.string().describe("메일 제목"),
      body: z.string().optional().describe("메일 본문"),
      cc: z.string().optional().describe("참조 이메일 (여러 명은 ; 로 구분)"),
      bcc: z.string().optional().describe("숨은참조 이메일 (여러 명은 ; 로 구분)"),
      contentType: z.enum(["html", "text"]).optional().describe("본문 형식 (기본: html)"),
      userId: z.string().optional().describe("발신자 ID (미지정 시 me)"),
    },
    async ({ to, subject, body, cc, bcc, contentType, userId }) => {
      try {
        await mailApi.sendMail({
          to,
          subject,
          body,
          cc,
          bcc,
          contentType,
          userId: userId ?? "me",
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: "메일이 전송되었습니다 (비동기 처리)" }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "mail.send") }],
          isError: true,
        };
      }
    }
  );

  // Tool 12: 메일 목록 조회
  defineTool(server,
    "nworks_mail_list",
    "받은 메일 목록을 조회합니다. '메일 확인해줘', '받은편지함 보여줘', '안 읽은 메일 있어?' 등의 요청에 사용. User OAuth 인증 필요 (mail.read scope)",
    {
      folderId: z.number().int().min(0).optional().describe("메일 폴더 ID (기본: 0 = 받은편지함)"),
      count: z.number().int().min(1).max(200).optional().describe("페이지당 항목 수 (기본: 30, 최대: 200)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
      isUnread: z.boolean().optional().describe("읽지 않은 메일만 조회"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ folderId, count, cursor, isUnread, userId }) => {
      try {
        const result = await mailApi.listMails(
          folderId ?? 0,
          userId ?? "me",
          count ?? 30,
          cursor,
          isUnread
        );
        const mails = result.mails.map((m) => ({
          mailId: m.mailId,
          from: m.from.email,
          subject: m.subject,
          date: m.receivedTime,
          status: m.status,
          attachments: m.attachCount ?? 0,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ mails, count: mails.length, totalCount: result.totalCount, unreadCount: result.unreadCount, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "mail.list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 13: 메일 상세 조회
  defineTool(server,
    "nworks_mail_read",
    "특정 메일의 상세 내용(본문, 첨부파일 등)을 조회합니다. '이 메일 내용 보여줘' 등의 요청에 사용. mailId는 nworks_mail_list로 조회 가능. User OAuth 인증 필요 (mail.read scope)",
    {
      mailId: z.number().int().min(0).describe("메일 ID (nworks_mail_list로 조회 가능)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ mailId, userId }) => {
      try {
        const result = await mailApi.readMail(
          mailId,
          userId ?? "me"
        );
        const mail = result.mail;
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            mailId: mail.mailId,
            from: mail.from,
            to: mail.to,
            cc: mail.cc ?? [],
            subject: mail.subject,
            body: mail.body,
            date: mail.receivedTime,
            attachments: result.attachments?.map((a) => ({
              id: a.attachmentId,
              filename: a.filename,
              contentType: a.contentType,
              size: a.size,
            })) ?? [],
          }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "mail.read") }],
          isError: true,
        };
      }
    }
  );

  // Tool 14: 메일 첨부파일 다운로드
  defineTool(server,
    "nworks_mail_download_attachment",
    "메일 첨부파일을 다운로드합니다. mailId와 attachmentId는 nworks_mail_read로 조회 가능. User OAuth 인증 필요 (mail.read scope). outputDir을 지정하면 로컬에 파일로 저장하고, 미지정 시 파일 내용을 직접 반환합니다 (텍스트는 text, 바이너리는 base64). 5MB 초과 파일은 반드시 outputDir를 지정해야 합니다.",
    {
      mailId: z.number().int().min(0).describe("메일 ID (nworks_mail_list로 조회 가능)"),
      attachmentId: z.number().int().min(0).describe("첨부파일 ID (nworks_mail_read로 조회 가능)"),
      outputDir: z.string().optional().describe("저장 디렉토리 (지정 시 파일로 저장, 미지정 시 내용을 직접 반환)"),
      outputName: z.string().optional().describe("저장 파일명 (미지정 시 원본 파일명)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ mailId, attachmentId, outputDir, outputName, userId }) => {
      try {
        const result = await mailApi.downloadAttachment(
          mailId,
          attachmentId,
          userId ?? "me"
        );

        const fileName = outputName ?? result.filename;

        if (outputDir) {
          // 로컬 저장 방식 (CLI 환경용)
          const { writeFile } = await import("node:fs/promises");
          const { join } = await import("node:path");
          const safeDir = validateLocalPath(outputDir);
          const safeName = sanitizeFileName(fileName);
          const outPath = join(safeDir, safeName);
          validateLocalPath(outPath, safeDir);
          await writeFile(outPath, result.buffer);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, fileName, path: outPath, size: result.buffer.length }) }],
          };
        }

        // 내용 직접 반환 방식 (MCP 환경용)
        const MAX_INLINE_SIZE = 5 * 1024 * 1024; // 5MB
        if (result.buffer.length > MAX_INLINE_SIZE) {
          const sizeMB = (result.buffer.length / (1024 * 1024)).toFixed(1);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: true, message: `파일이 너무 큽니다 (${sizeMB}MB). outputDir를 지정해서 로컬에 저장하세요.`, fileName, size: result.buffer.length }) }],
            isError: true,
          };
        }

        const textExtensions = /\.(txt|md|csv|json|xml|html|htm|css|js|ts|jsx|tsx|yaml|yml|toml|ini|cfg|conf|log|sh|bash|zsh|py|rb|java|go|rs|c|cpp|h|hpp|sql|graphql|env|gitignore|dockerignore|editorconfig)$/i;
        const isText = textExtensions.test(fileName);

        if (isText) {
          const text = result.buffer.toString("utf-8");
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, fileName, size: result.buffer.length, encoding: "text", content: text }) }],
          };
        }

        const base64 = result.buffer.toString("base64");
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, fileName, size: result.buffer.length, encoding: "base64", content: base64 }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "mail.download_attachment") }],
          isError: true,
        };
      }
    }
  );
}
