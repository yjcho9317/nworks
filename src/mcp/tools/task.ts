import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as taskApi from "../../api/task.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerTaskTools(server: McpServer): void {
  // Tool 14: 할 일 목록 조회
  defineTool(server,
    "nworks_task_list",
    "할 일(TODO) 목록을 조회합니다. '할 일 확인해줘', 'TODO 목록 보여줘', '남은 업무 뭐 있어?' 등의 요청에 사용. User OAuth 인증 필요 (task.read scope)",
    {
      categoryId: z.string().optional().describe("카테고리 ID (기본: default)"),
      status: z.enum(["TODO", "ALL"]).optional().describe("필터: TODO 또는 ALL (기본: ALL)"),
      count: z.number().int().min(1).max(100).optional().describe("페이지당 항목 수 (기본: 50, 최대: 100)"),
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
  defineTool(server,
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
  defineTool(server,
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
  defineTool(server,
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
}
