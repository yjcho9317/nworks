import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as messageApi from "../api/message.js";
import * as directoryApi from "../api/directory.js";
import * as calendarApi from "../api/calendar.js";
import * as driveApi from "../api/drive.js";
import * as mailApi from "../api/mail.js";
import * as taskApi from "../api/task.js";
import * as boardApi from "../api/board.js";
import { loadCredentials, loadToken } from "../auth/config.js";

export function registerTools(server: McpServer): void {
  // Tool 1: 메시지 전송
  server.tool(
    "nworks_message_send",
    "NAVER WORKS에서 사용자 또는 채널에 메시지를 전송합니다",
    {
      to: z.string().optional().describe("수신자 userId (channel과 택 1)"),
      channel: z.string().optional().describe("채널 channelId (to와 택 1)"),
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: 채널 구성원
  server.tool(
    "nworks_message_members",
    "특정 채널의 구성원 목록을 조회합니다",
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: 조직 구성원 목록
  server.tool(
    "nworks_directory_members",
    "NAVER WORKS 조직 구성원 목록을 조회합니다 (user.read scope 필요)",
    {},
    async () => {
      try {
        const result = await directoryApi.listUsers();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: 캘린더 일정 목록
  server.tool(
    "nworks_calendar_list",
    "사용자의 캘린더 일정을 조회합니다 (User OAuth calendar.read scope 필요. 먼저 nworks login --user 필요)",
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 5: 캘린더 일정 생성
  server.tool(
    "nworks_calendar_create",
    "캘린더 일정을 생성합니다 (User OAuth calendar scope 필요)",
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: 캘린더 일정 수정
  server.tool(
    "nworks_calendar_update",
    "캘린더 일정을 수정합니다 (User OAuth calendar scope 필요)",
    {
      eventId: z.string().describe("일정 ID"),
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
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, eventId, message: "Event updated" }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 7: 캘린더 일정 삭제
  server.tool(
    "nworks_calendar_delete",
    "캘린더 일정을 삭제합니다 (User OAuth calendar scope 필요)",
    {
      eventId: z.string().describe("삭제할 일정 ID"),
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
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, eventId, message: "Event deleted" }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 8: 드라이브 파일 목록
  server.tool(
    "nworks_drive_list",
    "드라이브 파일/폴더 목록을 조회합니다 (User OAuth file 또는 file.read scope 필요)",
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
          content: [{ type: "text" as const, text: JSON.stringify({ files, count: files.length, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
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
            content: [{ type: "text" as const, text: "Error: content+fileName 또는 filePath 중 하나를 지정해야 합니다. MCP 클라이언트에서는 파일 내용을 base64로 인코딩하여 content 파라미터에 전달하고, fileName에 파일명을 지정하세요." }],
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
          content: [{ type: "text" as const, text: `Error: ${error.message}${detail}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 10: 드라이브 파일 다운로드
  server.tool(
    "nworks_drive_download",
    "드라이브 파일을 다운로드합니다 (User OAuth file 또는 file.read scope 필요). outputDir을 지정하면 로컬에 파일로 저장하고, 미지정 시 파일 내용을 직접 반환합니다 (텍스트 파일은 text, 바이너리는 base64).",
    {
      fileId: z.string().describe("다운로드할 파일 ID"),
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 11: 메일 전송
  server.tool(
    "nworks_mail_send",
    "메일을 전송합니다 (User OAuth mail scope 필요). 비동기 전송으로, 성공 시 202 응답을 반환합니다.",
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
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: "Mail sent (async)" }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 12: 메일 목록 조회
  server.tool(
    "nworks_mail_list",
    "메일함의 메일 목록을 조회합니다 (User OAuth mail 또는 mail.read scope 필요)",
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
          content: [{ type: "text" as const, text: JSON.stringify({ mails, count: mails.length, totalCount: result.totalCount, unreadCount: result.unreadCount, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 13: 메일 상세 조회
  server.tool(
    "nworks_mail_read",
    "특정 메일의 상세 내용을 조회합니다 (User OAuth mail 또는 mail.read scope 필요)",
    {
      mailId: z.number().describe("메일 ID"),
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 14: 할 일 목록 조회
  server.tool(
    "nworks_task_list",
    "할 일 목록을 조회합니다 (User OAuth task 또는 task.read scope 필요)",
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
          content: [{ type: "text" as const, text: JSON.stringify({ tasks, count: tasks.length, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 15: 할 일 생성
  server.tool(
    "nworks_task_create",
    "할 일을 생성합니다 (User OAuth task scope 필요). 기본적으로 자기 자신에게 할당됩니다.",
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 16: 할 일 수정
  server.tool(
    "nworks_task_update",
    "할 일을 수정합니다 (User OAuth task scope 필요). 상태 변경(done/todo)과 필드 수정을 모두 지원합니다.",
    {
      taskId: z.string().describe("할 일 ID"),
      status: z.enum(["done", "todo"]).optional().describe("상태 변경: done 또는 todo"),
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
          content: [{ type: "text" as const, text: "Error: status, title, content, dueDate 중 하나 이상을 지정하세요." }],
          isError: true,
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 17: 할 일 삭제
  server.tool(
    "nworks_task_delete",
    "할 일을 삭제합니다 (User OAuth task scope 필요)",
    {
      taskId: z.string().describe("삭제할 할 일 ID"),
    },
    async ({ taskId }) => {
      try {
        await taskApi.deleteTask(taskId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, message: "Task deleted" }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 18: 게시판 목록
  server.tool(
    "nworks_board_list",
    "게시판 목록을 조회합니다 (User OAuth board 또는 board.read scope 필요)",
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
          content: [{ type: "text" as const, text: JSON.stringify({ boards, count: boards.length, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 19: 게시판 글 목록
  server.tool(
    "nworks_board_posts",
    "게시판의 글 목록을 조회합니다 (User OAuth board 또는 board.read scope 필요)",
    {
      boardId: z.string().describe("게시판 ID"),
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
          content: [{ type: "text" as const, text: JSON.stringify({ posts, count: posts.length, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 20: 게시판 글 상세 조회
  server.tool(
    "nworks_board_read",
    "게시판 글의 상세 내용을 조회합니다 (User OAuth board 또는 board.read scope 필요)",
    {
      boardId: z.string().describe("게시판 ID"),
      postId: z.string().describe("글 ID"),
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 21: 게시판 글 작성
  server.tool(
    "nworks_board_create",
    "게시판에 글을 작성합니다 (User OAuth board scope 필요)",
    {
      boardId: z.string().describe("게시판 ID"),
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
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 22: 인증 상태
  server.tool(
    "nworks_whoami",
    "현재 인증된 NAVER WORKS 계정 정보를 확인합니다",
    {},
    async () => {
      try {
        const creds = await loadCredentials();
        const token = await loadToken();
        const isValid = token
          ? token.expiresAt > Date.now() / 1000
          : false;

        const info = {
          serviceAccount: creds.serviceAccount ?? null,
          clientId: creds.clientId,
          botId: creds.botId ?? null,
          tokenValid: isValid,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(info) }],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
