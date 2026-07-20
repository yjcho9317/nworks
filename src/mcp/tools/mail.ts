import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as mailApi from "../../api/mail.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
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
}
