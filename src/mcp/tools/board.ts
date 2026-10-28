import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { realpath, stat } from "node:fs/promises";
import { delimiter } from "node:path";
import * as boardApi from "../../api/board.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { validateLocalPath } from "../../utils/sanitize.js";
import { defineTool } from "../tool-registry.js";

/**
 * 첨부 경로를 실제 경로로 풀고 검증한다.
 * NWORKS_UPLOAD_BASE(경로 구분자로 여러 개)가 있으면 그 하위 파일만 허용한다.
 * 심볼릭 링크로 허용 디렉토리를 벗어나지 못하도록 realpath 기준으로 본다.
 */
async function resolveAttachmentPath(filePath: string): Promise<string> {
  const real = await realpath(validateLocalPath(filePath));
  const bases = (process.env["NWORKS_UPLOAD_BASE"] ?? "").split(delimiter).filter(Boolean);
  if (bases.length > 0) {
    const ok = bases.some((base) => {
      try {
        validateLocalPath(real, base);
        return true;
      } catch {
        return false;
      }
    });
    if (!ok) throw new Error(`Path "${filePath}" is outside NWORKS_UPLOAD_BASE`);
  }
  if (!(await stat(real)).isFile()) throw new Error(`Not a file: "${filePath}"`);
  return real;
}

export function registerBoardTools(server: McpServer): void {
  // Tool 18: 게시판 목록
  defineTool(server,
    "nworks_board_list",
    "NAVER WORKS 게시판 목록을 조회합니다. '게시판 뭐 있어?', '공지사항 게시판 찾아줘' 등의 요청에 사용. User OAuth 인증 필요 (board.read scope)",
    {
      count: z.number().int().min(1).optional().describe("페이지당 항목 수 (기본: 20)"),
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
  defineTool(server,
    "nworks_board_posts",
    "게시판의 글 목록을 조회합니다. '게시판 글 보여줘', '공지사항 확인' 등의 요청에 사용. boardId는 nworks_board_list로 조회 가능. User OAuth 인증 필요 (board.read scope)",
    {
      boardId: z.string().describe("게시판 ID (nworks_board_list로 조회 가능)"),
      count: z.number().int().min(1).max(40).optional().describe("페이지당 항목 수 (기본: 20, 최대: 40)"),
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
  defineTool(server,
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
  defineTool(server,
    "nworks_board_create",
    "게시판에 글을 작성합니다. '게시판에 글 올려줘', '공지 작성해줘' 등의 요청에 사용. boardId는 nworks_board_list로 조회 가능. filePaths를 주면 글 작성 후 사진·파일을 첨부합니다 (본문 삽입이 아니라 첨부파일로 붙음). User OAuth 인증 필요 (board scope)",
    {
      boardId: z.string().describe("게시판 ID (nworks_board_list로 조회 가능)"),
      title: z.string().describe("글 제목"),
      body: z.string().optional().describe("글 본문"),
      enableComment: z.boolean().optional().describe("댓글 허용 (기본: true)"),
      sendNotifications: z.boolean().optional().describe("알림 발송 (기본: false)"),
      filePaths: z.array(z.string()).max(20).optional().describe("첨부할 로컬 파일 경로 목록 (최대 20개, 파일당 100MB). 글 작성 후 순서대로 첨부"),
    },
    async ({ boardId, title, body, enableComment, sendNotifications, filePaths }) => {
      try {
        // 경로가 하나라도 잘못되면 글을 만들기 전에 멈춘다 (첨부 없는 반쪽 글 방지)
        const paths = await Promise.all((filePaths ?? []).map(resolveAttachmentPath));

        const post = await boardApi.createPost({
          boardId,
          title,
          body,
          enableComment,
          sendNotifications,
        });

        if (paths.length === 0) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, postId: post.postId, boardId: post.boardId, title: post.title }) }],
          };
        }

        // 글은 이미 올라갔으므로 첨부 실패는 파일별로 보고하고 계속한다
        const attachments: Array<Record<string, unknown>> = [];
        for (const p of paths) {
          try {
            const r = await boardApi.addPostAttachment(boardId, String(post.postId), p);
            attachments.push({ success: true, ...r });
          } catch (err) {
            attachments.push({ success: false, filePath: p, error: (err as Error).message });
          }
        }
        const failed = attachments.filter((a) => !a.success).length;

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, postId: post.postId, boardId: post.boardId, title: post.title, attachments, attachedCount: paths.length - failed, failedCount: failed }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "board.create") }],
          isError: true,
        };
      }
    }
  );
}
