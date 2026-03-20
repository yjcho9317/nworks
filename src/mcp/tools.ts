import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as messageApi from "../api/message.js";
import * as directoryApi from "../api/directory.js";
import * as calendarApi from "../api/calendar.js";
import * as driveApi from "../api/drive.js";
import * as mailApi from "../api/mail.js";
import * as taskApi from "../api/task.js";
import * as boardApi from "../api/board.js";
import { clearCredentials, loadCredentials, loadToken, loadUserToken, saveCredentials, saveUserToken } from "../auth/config.js";
import { runChecks } from "../commands/doctor.js";
import { buildAuthorizeUrl, startOAuthCallbackServer } from "../auth/oauth-user.js";
import { mcpErrorHint } from "../utils/error-hints.js";

export function registerTools(server: McpServer): void {
  // Tool 0: 초기 설정
  server.tool(
    "nworks_setup",
    `NAVER WORKS API 인증 정보를 설정합니다.

■ 사전 준비 (사용자가 직접 해야 함):
  1. https://dev.worksmobile.com 에서 앱 생성 후 Client ID와 Client Secret을 발급받습니다.
  2. MCP 설정 파일(예: claude_desktop_config.json)의 nworks 서버에 env 필드를 추가합니다:
     { "env": { "NWORKS_CLIENT_SECRET": "<발급받은 Client Secret>" } }
  3. MCP 클라이언트(예: Claude Desktop)를 재시작합니다.

■ 이 tool의 역할:
  - clientId(필수)와 serviceAccount, botId, domainId(선택)를 파라미터로 받아 저장합니다.
  - Client Secret은 보안을 위해 파라미터로 받지 않으며, 환경변수 NWORKS_CLIENT_SECRET에서 자동으로 읽습니다.
  - Service Account 사용 시 환경변수 NWORKS_PRIVATE_KEY_PATH도 필요합니다.

■ 설정 후 다음 단계:
  - 캘린더/메일/드라이브/할일/게시판 → nworks_login_user tool로 브라우저 로그인 필요
  - 메시지/구성원조회 → Service Account 인증 (serviceAccount + botId + NWORKS_PRIVATE_KEY_PATH)

■ 환경변수 NWORKS_CLIENT_SECRET이 없으면 이 tool은 실패합니다. 실패 시 사용자에게 위 사전 준비 단계를 안내하세요.

OAuth Redirect URI: http://localhost:9876/callback`,
    {
      clientId: z.string().describe("Client ID (Developer Console에서 발급)"),
      serviceAccount: z.string().optional().describe("Service Account ID (예: xxxxx.serviceaccount@domain)"),
      botId: z.string().optional().describe("Bot ID (메시지 전송 시 필요)"),
      domainId: z.string().optional().describe("Domain ID"),
    },
    async ({ clientId, serviceAccount, botId, domainId }) => {
      try {
        const resolvedSecret = process.env["NWORKS_CLIENT_SECRET"];
        if (!resolvedSecret) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
                  error: true,
                  message: "환경변수 NWORKS_CLIENT_SECRET이 설정되어 있지 않습니다.",
                  userAction: [
                    "1. https://dev.worksmobile.com 에서 앱의 Client Secret을 확인합니다.",
                    '2. MCP 설정 파일(예: claude_desktop_config.json)을 열고, nworks 서버 설정에 다음을 추가합니다:',
                    '   "env": { "NWORKS_CLIENT_SECRET": "<Client Secret>" }',
                    "3. MCP 클라이언트(예: Claude Desktop)를 재시작합니다.",
                    "4. 재시작 후 다시 시도해주세요.",
                  ],
                  configExample: '{ "mcpServers": { "nworks": { "command": "npx", "args": ["-y", "nworks", "mcp"], "env": { "NWORKS_CLIENT_SECRET": "<Client Secret>" } } } }',
                }) }],
            isError: true,
          };
        }

        const resolvedPrivateKeyPath = process.env["NWORKS_PRIVATE_KEY_PATH"];

        await saveCredentials({
          clientId,
          clientSecret: resolvedSecret,
          serviceAccount,
          privateKeyPath: resolvedPrivateKeyPath,
          botId,
          domainId,
        });

        const nextSteps: string[] = [];
        if (serviceAccount && resolvedPrivateKeyPath && botId) {
          nextSteps.push("Service Account 인증 준비 완료 — 봇 메시지 등 바로 사용 가능");
        } else if (serviceAccount && botId && !resolvedPrivateKeyPath) {
          nextSteps.push("NWORKS_PRIVATE_KEY_PATH 환경변수가 설정되지 않았습니다. Service Account 인증에는 Private Key 파일 경로가 필요합니다. 사용자에게 안내하세요: (1) Developer Console(https://dev.worksmobile.com)에서 Private Key를 다운로드 (2) MCP 설정 파일의 env에 NWORKS_PRIVATE_KEY_PATH를 추가 (예: \"NWORKS_PRIVATE_KEY_PATH\": \"C:/keys/private.key\") (3) MCP 클라이언트 재시작");
        }
        nextSteps.push("User OAuth가 필요한 API는 nworks_login_user tool로 브라우저 로그인을 진행하세요");

        const mask = (s: string) => s.length <= 4 ? "****" : `****${s.slice(-Math.min(4, Math.floor(s.length / 3)))}`;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "인증 정보가 저장되었습니다.",
                nextSteps,
                clientId,
                clientSecret: `${mask(resolvedSecret)} (환경변수)`,
                serviceAccount: serviceAccount ?? null,
                privateKeyPath: resolvedPrivateKeyPath ? `${mask(resolvedPrivateKeyPath)} (환경변수)` : null,
                botId: botId ?? null,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 1: 메시지 전송
  server.tool(
    "nworks_message_send",
    "NAVER WORKS 메시지를 전송합니다 (봇이 사용자 또는 채널에 발송). Service Account 인증 사용 (nworks_setup에서 serviceAccount, botId 설정 + 환경변수 NWORKS_PRIVATE_KEY_PATH 필요. User OAuth 불필요)",
    {
      to: z.string().optional().describe("수신자 userId (channel과 택 1). nworks_directory_members로 userId 조회 가능"),
      channel: z.string().optional().describe("채널 channelId (to와 택 1). nworks_message_members로 채널 구성원 확인 가능"),
      text: z.string().describe("메시지 본문"),
      type: z
        .enum(["text", "button", "list"])
        .optional()
        .describe("메시지 타입 (기본: text)"),
      actions: z
        .string()
        .optional()
        .describe("버튼 액션 JSON (type=button일 때)"),
      elements: z
        .string()
        .optional()
        .describe("리스트 항목 JSON (type=list일 때)"),
    },
    async ({ to, channel, text, type, actions, elements }) => {
      try {
        const result = await messageApi.send({
          to,
          channel,
          text,
          type,
          actions,
          elements,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: 채널 구성원
  server.tool(
    "nworks_message_members",
    "특정 채널의 구성원 목록을 조회합니다. '이 채널에 누가 있어?' 등의 요청에 사용. Service Account 인증 사용 (nworks_setup 필요)",
    {
      channel: z.string().describe("채널 channelId"),
    },
    async ({ channel }) => {
      try {
        const result = await messageApi.listMembers(channel);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: 조직 구성원 목록
  server.tool(
    "nworks_directory_members",
    "NAVER WORKS 조직 구성원(직원) 목록을 조회합니다. '구성원 목록 보여줘', '팀원 찾아줘', '누구한테 메시지 보낼지 userId 찾기' 등에 사용. Service Account 인증 사용 (nworks_setup 필요). 메시지 전송 시 수신자 userId를 여기서 조회 가능",
    {},
    async () => {
      try {
        const result = await directoryApi.listUsers();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: 캘린더 일정 목록
  server.tool(
    "nworks_calendar_list",
    "사용자의 캘린더 일정/스케줄을 조회합니다. '오늘 일정 알려줘', '이번 주 스케줄 확인' 등의 요청에 사용. User OAuth 인증 필요 (calendar.read scope). 미로그인 시 nworks_login_user로 로그인 필요",
    {
      fromDateTime: z.string().describe("시작 일시 (YYYY-MM-DDThh:mm:ss+09:00)"),
      untilDateTime: z.string().describe("종료 일시 (YYYY-MM-DDThh:mm:ss+09:00)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ fromDateTime, untilDateTime, userId }) => {
      try {
        const result = await calendarApi.listEvents(
          fromDateTime,
          untilDateTime,
          userId ?? "me"
        );
        const events = result.events.flatMap((e) =>
          e.eventComponents.map((c) => ({
            eventId: c.eventId,
            summary: c.summary,
            start: c.start.dateTime ?? c.start.date ?? "",
            end: c.end.dateTime ?? c.end.date ?? "",
            location: c.location ?? "",
          }))
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ events, count: events.length }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "calendar.list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 5: 캘린더 일정 생성
  server.tool(
    "nworks_calendar_create",
    "캘린더 일정을 새로 만듭니다. '회의 잡아줘', '일정 등록해줘' 등의 요청에 사용. User OAuth 인증 필요 (calendar + calendar.read scope)",
    {
      summary: z.string().describe("일정 제목"),
      start: z.string().describe("시작 일시 (YYYY-MM-DDThh:mm:ss)"),
      end: z.string().describe("종료 일시 (YYYY-MM-DDThh:mm:ss)"),
      timeZone: z.string().optional().describe("타임존 (기본: Asia/Seoul)"),
      description: z.string().optional().describe("일정 설명"),
      location: z.string().optional().describe("장소"),
      attendees: z.array(z.object({ email: z.string(), displayName: z.string().optional() })).optional().describe("참석자 목록"),
      sendNotification: z.boolean().optional().describe("참석자에게 알림 발송 (기본: false)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ summary, start, end, timeZone, description, location, attendees, sendNotification, userId }) => {
      try {
        const result = await calendarApi.createEvent({
          summary,
          start,
          end,
          timeZone,
          description,
          location,
          attendees,
          sendNotification,
          userId: userId ?? "me",
        });
        const event = result.eventComponents?.[0];
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, eventId: event?.eventId, summary: event?.summary, start: event?.start, end: event?.end }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "calendar.create") }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: 캘린더 일정 수정
  server.tool(
    "nworks_calendar_update",
    "기존 캘린더 일정을 수정합니다. '일정 시간 변경해줘', '회의 제목 바꿔줘' 등의 요청에 사용. User OAuth 인증 필요 (calendar + calendar.read scope). eventId는 nworks_calendar_list로 조회 가능",
    {
      eventId: z.string().describe("일정 ID (nworks_calendar_list로 조회 가능)"),
      summary: z.string().optional().describe("새 제목"),
      start: z.string().optional().describe("새 시작 일시 (YYYY-MM-DDThh:mm:ss)"),
      end: z.string().optional().describe("새 종료 일시 (YYYY-MM-DDThh:mm:ss)"),
      timeZone: z.string().optional().describe("타임존 (기본: Asia/Seoul)"),
      description: z.string().optional().describe("새 설명"),
      location: z.string().optional().describe("새 장소"),
      sendNotification: z.boolean().optional().describe("참석자에게 알림 발송 (기본: false)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ eventId, summary, start, end, timeZone, description, location, sendNotification, userId }) => {
      try {
        await calendarApi.updateEvent({
          eventId,
          summary,
          start,
          end,
          timeZone,
          description,
          location,
          sendNotification,
          userId: userId ?? "me",
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, eventId, message: "일정이 수정되었습니다" }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "calendar.update") }],
          isError: true,
        };
      }
    }
  );

  // Tool 7: 캘린더 일정 삭제
  server.tool(
    "nworks_calendar_delete",
    "캘린더 일정을 삭제합니다. '일정 취소해줘' 등의 요청에 사용. User OAuth 인증 필요 (calendar + calendar.read scope). eventId는 nworks_calendar_list로 조회 가능",
    {
      eventId: z.string().describe("삭제할 일정 ID (nworks_calendar_list로 조회 가능)"),
      sendNotification: z.boolean().optional().describe("참석자에게 알림 발송 (기본: false)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ eventId, sendNotification, userId }) => {
      try {
        await calendarApi.deleteEvent(
          eventId,
          userId ?? "me",
          sendNotification ?? false
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, eventId, message: "일정이 삭제되었습니다" }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "calendar.delete") }],
          isError: true,
        };
      }
    }
  );

  // Tool 8: 드라이브 파일 목록
  server.tool(
    "nworks_drive_list",
    "NAVER WORKS 드라이브의 파일/폴더 목록을 조회합니다. '드라이브 파일 보여줘', '내 파일 목록' 등의 요청에 사용. User OAuth 인증 필요 (file.read scope)",
    {
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
      folderId: z.string().optional().describe("폴더 ID (미지정 시 루트)"),
      count: z.number().optional().describe("페이지당 항목 수 (기본: 20, 최대: 200)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
    },
    async ({ userId, folderId, count, cursor }) => {
      try {
        const result = await driveApi.listFiles(
          userId ?? "me",
          folderId,
          count ?? 20,
          cursor
        );
        const files = result.files.map((f) => ({
          fileId: f.fileId,
          name: f.fileName,
          type: f.fileType,
          size: f.fileSize,
          modified: f.modifiedTime,
          path: f.filePath,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ files, count: files.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 9: 드라이브 파일 업로드
  server.tool(
    "nworks_drive_upload",
    "파일을 드라이브에 업로드합니다 (User OAuth file scope 필요). content(base64)와 fileName으로 전달하거나, filePath로 로컬 파일 경로를 지정합니다. MCP 클라이언트에서는 content+fileName 방식을 권장합니다.",
    {
      content: z.string().optional().describe("업로드할 파일 내용 (base64 인코딩). filePath 대신 사용"),
      fileName: z.string().optional().describe("파일명 (content 사용 시 필수)"),
      filePath: z.string().optional().describe("업로드할 로컬 파일 경로 (content 대신 사용, 로컬 환경에서만 동작)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
      folderId: z.string().optional().describe("업로드할 폴더 ID (미지정 시 루트)"),
      overwrite: z.boolean().optional().describe("동일 파일명 덮어쓰기 (기본: false)"),
    },
    async ({ content, fileName, filePath, userId, folderId, overwrite }) => {
      try {
        let result: driveApi.UploadResult;

        if (content && fileName) {
          // MCP 방식: base64 content를 직접 받아서 업로드
          const buffer = Buffer.from(content, "base64");
          if (process.env["NWORKS_VERBOSE"] === "1") {
            console.error(`[nworks] MCP upload: fileName=${fileName}, bufferSize=${buffer.length}`);
          }
          result = await driveApi.uploadBuffer(
            buffer,
            fileName,
            userId ?? "me",
            folderId,
            overwrite ?? false
          );
        } else if (filePath) {
          // 로컬 파일 경로 방식
          if (process.env["NWORKS_VERBOSE"] === "1") {
            console.error(`[nworks] MCP upload: filePath=${filePath}`);
          }
          result = await driveApi.uploadFile(
            filePath,
            userId ?? "me",
            folderId,
            overwrite ?? false
          );
        } else {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: true, message: "content+fileName 또는 filePath 중 하나를 지정해야 합니다. MCP 클라이언트에서는 파일 내용을 base64로 인코딩하여 content 파라미터에 전달하고, fileName에 파일명을 지정하세요." }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }) }],
        };
      } catch (err) {
        const error = err as Error;
        const detail = process.env["NWORKS_VERBOSE"] === "1"
          ? ` | stack: ${error.stack}`
          : "";
        return {
          content: [{ type: "text" as const, text: `${mcpErrorHint(err, "drive.upload")}${detail}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 10: 드라이브 파일 다운로드
  server.tool(
    "nworks_drive_download",
    "드라이브 파일을 다운로드합니다. User OAuth 인증 필요 (file.read scope). outputDir을 지정하면 로컬에 파일로 저장하고, 미지정 시 파일 내용을 직접 반환합니다 (텍스트는 text, 바이너리는 base64). 5MB 초과 파일은 반드시 outputDir를 지정해야 합니다.",
    {
      fileId: z.string().describe("다운로드할 파일 ID (nworks_drive_list로 조회 가능)"),
      outputDir: z.string().optional().describe("저장 디렉토리 (지정 시 파일로 저장, 미지정 시 내용을 직접 반환)"),
      outputName: z.string().optional().describe("저장 파일명 (미지정 시 원본 파일명)"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ fileId, outputDir, outputName, userId }) => {
      try {
        const result = await driveApi.downloadFile(
          fileId,
          userId ?? "me"
        );

        const fileName = outputName ?? result.fileName ?? fileId;

        if (outputDir) {
          // 로컬 저장 방식 (CLI 환경용)
          const { writeFile } = await import("node:fs/promises");
          const { join } = await import("node:path");
          const outPath = join(outputDir, fileName);
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
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.download") }],
          isError: true,
        };
      }
    }
  );

  // Tool 11: 메일 전송
  server.tool(
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
  server.tool(
    "nworks_mail_list",
    "받은 메일 목록을 조회합니다. '메일 확인해줘', '받은편지함 보여줘', '안 읽은 메일 있어?' 등의 요청에 사용. User OAuth 인증 필요 (mail.read scope)",
    {
      folderId: z.number().optional().describe("메일 폴더 ID (기본: 0 = 받은편지함)"),
      count: z.number().optional().describe("페이지당 항목 수 (기본: 30, 최대: 200)"),
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
  server.tool(
    "nworks_mail_read",
    "특정 메일의 상세 내용(본문, 첨부파일 등)을 조회합니다. '이 메일 내용 보여줘' 등의 요청에 사용. mailId는 nworks_mail_list로 조회 가능. User OAuth 인증 필요 (mail.read scope)",
    {
      mailId: z.number().describe("메일 ID (nworks_mail_list로 조회 가능)"),
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

  // Tool 14: 할 일 목록 조회
  server.tool(
    "nworks_task_list",
    "할 일(TODO) 목록을 조회합니다. '할 일 확인해줘', 'TODO 목록 보여줘', '남은 업무 뭐 있어?' 등의 요청에 사용. User OAuth 인증 필요 (task.read scope)",
    {
      categoryId: z.string().optional().describe("카테고리 ID (기본: default)"),
      status: z.enum(["TODO", "ALL"]).optional().describe("필터: TODO 또는 ALL (기본: ALL)"),
      count: z.number().optional().describe("페이지당 항목 수 (기본: 50, 최대: 100)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
    },
    async ({ categoryId, status, count, cursor, userId }) => {
      try {
        const result = await taskApi.listTasks(
          categoryId ?? "default",
          userId ?? "me",
          count ?? 50,
          cursor,
          status ?? "ALL"
        );
        const tasks = result.tasks.map((t) => ({
          taskId: t.taskId,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          assignor: t.assignorName ?? t.assignorId,
          created: t.createdTime,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ tasks, count: tasks.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "task.list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 15: 할 일 생성
  server.tool(
    "nworks_task_create",
    "할 일(TODO)을 새로 만듭니다. '할 일 추가해줘', 'TODO 등록해줘' 등의 요청에 사용. 기본적으로 자기 자신에게 할당. User OAuth 인증 필요 (task + user.read scope)",
    {
      title: z.string().describe("할 일 제목"),
      content: z.string().optional().describe("할 일 내용"),
      dueDate: z.string().optional().describe("마감일 (YYYY-MM-DD)"),
      categoryId: z.string().optional().describe("카테고리 ID"),
      assigneeIds: z.array(z.string()).optional().describe("담당자 user ID 목록 (미지정 시 자기 자신)"),
      userId: z.string().optional().describe("생성자 user ID (미지정 시 me)"),
    },
    async ({ title, content, dueDate, categoryId, assigneeIds, userId }) => {
      try {
        const result = await taskApi.createTask({
          title,
          content,
          dueDate,
          categoryId,
          assigneeIds,
          userId: userId ?? "me",
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId: result.taskId, title: result.title, status: result.status, dueDate: result.dueDate }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "task.create") }],
          isError: true,
        };
      }
    }
  );

  // Tool 16: 할 일 수정
  server.tool(
    "nworks_task_update",
    "할 일을 수정하거나 완료 처리합니다. '할 일 완료 처리해줘', '마감일 변경해줘' 등의 요청에 사용. taskId는 nworks_task_list로 조회 가능. User OAuth 인증 필요 (task + user.read scope)",
    {
      taskId: z.string().describe("할 일 ID (nworks_task_list로 조회 가능)"),
      status: z.enum(["done", "todo"]).optional().describe("상태 변경: done(완료) 또는 todo(미완료)"),
      title: z.string().optional().describe("새 제목"),
      content: z.string().optional().describe("새 내용"),
      dueDate: z.string().optional().describe("새 마감일 (YYYY-MM-DD)"),
    },
    async ({ taskId, status, title, content, dueDate }) => {
      try {
        // 상태 변경
        if (status) {
          if (status === "done") {
            await taskApi.completeTask(taskId);
          } else {
            await taskApi.incompleteTask(taskId);
          }
        }

        // 필드 수정
        if (title !== undefined || content !== undefined || dueDate !== undefined) {
          const result = await taskApi.updateTask({ taskId, title, content, dueDate });
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId: result.taskId, title: result.title, status: result.status, dueDate: result.dueDate }) }],
          };
        }

        if (status) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, status: status === "done" ? "DONE" : "TODO" }) }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: true, message: "status, title, content, dueDate 중 하나 이상을 지정하세요." }) }],
          isError: true,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "task.update") }],
          isError: true,
        };
      }
    }
  );

  // Tool 17: 할 일 삭제
  server.tool(
    "nworks_task_delete",
    "할 일을 삭제합니다. taskId는 nworks_task_list로 조회 가능. User OAuth 인증 필요 (task + user.read scope)",
    {
      taskId: z.string().describe("삭제할 할 일 ID (nworks_task_list로 조회 가능)"),
    },
    async ({ taskId }) => {
      try {
        await taskApi.deleteTask(taskId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, message: "할 일이 삭제되었습니다" }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "task.delete") }],
          isError: true,
        };
      }
    }
  );

  // Tool 18: 게시판 목록
  server.tool(
    "nworks_board_list",
    "NAVER WORKS 게시판 목록을 조회합니다. '게시판 뭐 있어?', '공지사항 게시판 찾아줘' 등의 요청에 사용. User OAuth 인증 필요 (board.read scope)",
    {
      count: z.number().optional().describe("페이지당 항목 수 (기본: 20)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
    },
    async ({ count, cursor }) => {
      try {
        const result = await boardApi.listBoards(count ?? 20, cursor);
        const boards = result.boards.map((b) => ({
          boardId: b.boardId,
          boardName: b.boardName,
          description: b.description ?? "",
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ boards, count: boards.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "board.list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 19: 게시판 글 목록
  server.tool(
    "nworks_board_posts",
    "게시판의 글 목록을 조회합니다. '게시판 글 보여줘', '공지사항 확인' 등의 요청에 사용. boardId는 nworks_board_list로 조회 가능. User OAuth 인증 필요 (board.read scope)",
    {
      boardId: z.string().describe("게시판 ID (nworks_board_list로 조회 가능)"),
      count: z.number().optional().describe("페이지당 항목 수 (기본: 20, 최대: 40)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
    },
    async ({ boardId, count, cursor }) => {
      try {
        const result = await boardApi.listPosts(boardId, count ?? 20, cursor);
        const posts = result.posts.map((p) => ({
          postId: p.postId,
          title: p.title,
          userName: p.userName ?? "",
          readCount: p.readCount ?? 0,
          commentCount: p.commentCount ?? 0,
          createdTime: p.createdTime ?? "",
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ posts, count: posts.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "board.posts") }],
          isError: true,
        };
      }
    }
  );

  // Tool 20: 게시판 글 상세 조회
  server.tool(
    "nworks_board_read",
    "게시판 글의 상세 내용을 조회합니다. postId는 nworks_board_posts로 조회 가능. User OAuth 인증 필요 (board.read scope)",
    {
      boardId: z.string().describe("게시판 ID (nworks_board_list로 조회 가능)"),
      postId: z.string().describe("글 ID (nworks_board_posts로 조회 가능)"),
    },
    async ({ boardId, postId }) => {
      try {
        const post = await boardApi.readPost(boardId, postId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            postId: post.postId,
            boardId: post.boardId,
            title: post.title,
            body: post.body ?? "",
            userName: post.userName ?? "",
            readCount: post.readCount ?? 0,
            commentCount: post.commentCount ?? 0,
            createdTime: post.createdTime ?? "",
            updatedTime: post.updatedTime ?? "",
          }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "board.read") }],
          isError: true,
        };
      }
    }
  );

  // Tool 21: 게시판 글 작성
  server.tool(
    "nworks_board_create",
    "게시판에 글을 작성합니다. '게시판에 글 올려줘', '공지 작성해줘' 등의 요청에 사용. boardId는 nworks_board_list로 조회 가능. User OAuth 인증 필요 (board scope)",
    {
      boardId: z.string().describe("게시판 ID (nworks_board_list로 조회 가능)"),
      title: z.string().describe("글 제목"),
      body: z.string().optional().describe("글 본문"),
      enableComment: z.boolean().optional().describe("댓글 허용 (기본: true)"),
      sendNotifications: z.boolean().optional().describe("알림 발송 (기본: false)"),
    },
    async ({ boardId, title, body, enableComment, sendNotifications }) => {
      try {
        const post = await boardApi.createPost({
          boardId,
          title,
          body,
          enableComment,
          sendNotifications,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, postId: post.postId, boardId: post.boardId, title: post.title }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "board.create") }],
          isError: true,
        };
      }
    }
  );

  // Tool 22: User OAuth 로그인
  server.tool(
    "nworks_login_user",
    "User OAuth 로그인을 시작합니다. 반환된 URL을 브라우저에서 열어 NAVER WORKS에 로그인하세요. 로그인 완료 후 자동으로 토큰이 저장됩니다. 중요: scope를 지정하지 마세요. 기본값이 모든 API(캘린더, 메일, 할일, 드라이브, 게시판)를 포함하므로 한 번 로그인으로 전체 기능을 사용할 수 있습니다. scope를 좁게 지정하면 다른 기능 사용 시 재로그인이 필요합니다.",
    {
      scope: z
        .string()
        .optional()
        .describe("지정하지 마세요 (기본값이 전체 scope 포함). 특수한 경우에만 사용"),
    },
    async ({ scope }) => {
      const DEFAULT_SCOPE = "calendar calendar.read file file.read mail mail.read task task.read user.read board board.read";
      try {
        const creds = await loadCredentials();

        // scope 의존성 자동 확장
        // - calendar 쓰기는 calendar.read 필요 (수정/삭제 시 기존 일정 조회)
        // - task 쓰기는 user.read 필요 (/users/me 호출)
        const SCOPE_DEPS: Record<string, string[]> = {
          calendar: ["calendar.read"],
          task: ["user.read"],
          "task.read": ["user.read"],
        };

        const expandScopes = (scopes: string[]): string[] => {
          const expanded = new Set(scopes);
          for (const s of scopes) {
            const deps = SCOPE_DEPS[s];
            if (deps) deps.forEach((d) => expanded.add(d));
          }
          return [...expanded];
        };

        // 기존 토큰의 scope와 합치기
        const existingToken = await loadUserToken();
        const existingScopes = existingToken?.scope?.split(" ").filter(Boolean) ?? [];
        const requestedScopes = expandScopes((scope ?? DEFAULT_SCOPE).split(" ").filter(Boolean));
        const mergedScopes = [...new Set([...existingScopes, ...requestedScopes])].join(" ");

        const state = Math.random().toString(36).substring(2);
        const authorizeUrl = buildAuthorizeUrl(creds.clientId, mergedScopes, state);

        // 콜백 서버를 백그라운드로 시작 (토큰 교환 및 저장까지 자동 처리)
        startOAuthCallbackServer(creds.clientId, creds.clientSecret)
          .then((token) =>
            saveUserToken({
              accessToken: token.accessToken,
              refreshToken: token.refreshToken,
              expiresAt: token.expiresAt,
              scope: token.scope,
            })
          )
          .then(() => {
            console.error("[nworks] User OAuth login successful. Token saved.");
          })
          .catch((err: Error) => {
            console.error(`[nworks] User OAuth login failed: ${err.message}`);
          });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message:
                  "아래 URL을 브라우저에서 열어 NAVER WORKS에 로그인하세요. 로그인 완료 후 자동으로 토큰이 저장됩니다. (제한시간: 120초)",
                loginUrl: authorizeUrl,
                scope: mergedScopes,
                callbackPort: 9876,
                timeout: "120초",
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 23: 인증 상태
  server.tool(
    "nworks_whoami",
    "현재 인증된 NAVER WORKS 계정 정보와 토큰 유효 상태를 확인합니다. 인증 문제 진단 시 먼저 호출",
    {},
    async () => {
      try {
        const creds = await loadCredentials();
        const token = await loadToken();
        const userToken = await loadUserToken();
        const isValid = token
          ? token.expiresAt > Date.now() / 1000
          : false;
        const userTokenValid = userToken
          ? userToken.expiresAt > Date.now() / 1000
          : false;

        const info = {
          serviceAccount: creds.serviceAccount ?? null,
          clientId: creds.clientId,
          botId: creds.botId ?? null,
          tokenValid: isValid,
          userOAuth: userToken
            ? { valid: userTokenValid, scope: userToken.scope }
            : null,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(info) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 24: 로그아웃
  server.tool(
    "nworks_logout",
    "저장된 NAVER WORKS 인증 정보와 토큰을 모두 삭제합니다",
    {},
    async () => {
      try {
        await clearCredentials();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "인증 정보와 토큰이 모두 삭제되었습니다. 다시 사용하려면 nworks_setup tool로 재설정 후 nworks_login_user로 브라우저 로그인하세요.",
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err) }],
          isError: true,
        };
      }
    }
  );

  // Tool 25: 진단
  server.tool(
    "nworks_doctor",
    "NAVER WORKS 연결 상태를 진단합니다. 인증 정보, 토큰, Private Key, API 연결을 점검합니다.",
    {},
    async () => {
      try {
        const results = await runChecks("default");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(results) }],
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
