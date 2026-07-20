import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as calendarApi from "../../api/calendar.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerCalendarTools(server: McpServer): void {
  // Tool 4: 캘린더 일정 목록
  defineTool(server,
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
  defineTool(server,
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
    async ({
      summary, start, end, timeZone,
      description, location, attendees,
      sendNotification, userId,
    }) => {
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
  defineTool(server,
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
    async ({
      eventId, summary, start, end, timeZone,
      description, location,
      sendNotification, userId,
    }) => {
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
  defineTool(server,
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
}
