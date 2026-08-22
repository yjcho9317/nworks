import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as driveApi from "../../api/drive.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { validateLocalPath, sanitizeFileName } from "../../utils/sanitize.js";
import { defineTool } from "../tool-registry.js";

export function registerDriveTools(server: McpServer): void {
  // Tool 8: 드라이브 파일 목록
  defineTool(server,
    "nworks_drive_list",
    "NAVER WORKS 드라이브의 파일/폴더 목록을 조회합니다. '드라이브 파일 보여줘', '내 파일 목록' 등의 요청에 사용. User OAuth 인증 필요 (file.read scope)",
    {
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
      folderId: z.string().optional().describe("폴더 ID (미지정 시 루트)"),
      count: z.number().int().min(1).max(200).optional().describe("페이지당 항목 수 (기본: 20, 최대: 200)"),
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
  defineTool(server,
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
          const safePath = validateLocalPath(filePath);
          if (process.env["NWORKS_VERBOSE"] === "1") {
            console.error(`[nworks] MCP upload: filePath=${safePath}`);
          }
          result = await driveApi.uploadFile(
            safePath,
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
        if (process.env["NWORKS_VERBOSE"] === "1") {
          console.error(`[nworks] drive upload error: ${(err as Error).stack}`);
        }
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.upload") }],
          isError: true,
        };
      }
    }
  );

  // Tool 10: 드라이브 파일 다운로드
  defineTool(server,
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
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.download") }],
          isError: true,
        };
      }
    }
  );

  // Tool 10b: 공유 드라이브 목록
  defineTool(server,
    "nworks_sharedrive_list",
    "NAVER WORKS 공유 드라이브 목록을 조회합니다. '공유 드라이브 뭐 있어?', '팀 공유 드라이브 찾아줘' 등의 요청에 사용. User OAuth 인증 필요 (file.read scope)",
    {
      count: z.number().int().min(1).max(200).optional().describe("페이지당 항목 수 (기본: 20, 최대: 200)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
    },
    async ({ count, cursor }) => {
      try {
        const result = await driveApi.listSharedDrives(count ?? 20, cursor);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ sharedDrives: result.sharedDrives, count: result.sharedDrives.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.sharedrive_list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 10c: 공유 드라이브 파일 목록
  defineTool(server,
    "nworks_sharedrive_files",
    "공유 드라이브의 파일/폴더 목록을 조회합니다. sharedriveId는 nworks_sharedrive_list로 조회 가능. User OAuth 인증 필요 (file.read scope)",
    {
      sharedriveId: z.string().describe("공유 드라이브 ID (nworks_sharedrive_list로 조회 가능)"),
      folderId: z.string().optional().describe("폴더 ID (미지정 시 루트)"),
      count: z.number().int().min(1).max(200).optional().describe("페이지당 항목 수 (기본: 20, 최대: 200)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
    },
    async ({ sharedriveId, folderId, count, cursor }) => {
      try {
        const result = await driveApi.listSharedDriveFiles(
          sharedriveId,
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
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.sharedrive_files") }],
          isError: true,
        };
      }
    }
  );

  // Tool 10d: 공유 드라이브 파일 다운로드
  defineTool(server,
    "nworks_sharedrive_download",
    "공유 드라이브 파일을 다운로드합니다. User OAuth 인증 필요 (file.read scope). outputDir을 지정하면 로컬에 파일로 저장하고, 미지정 시 파일 내용을 직접 반환합니다 (텍스트는 text, 바이너리는 base64). 5MB 초과 파일은 반드시 outputDir를 지정해야 합니다.",
    {
      sharedriveId: z.string().describe("공유 드라이브 ID (nworks_sharedrive_list로 조회 가능)"),
      fileId: z.string().describe("다운로드할 파일 ID (nworks_sharedrive_files로 조회 가능)"),
      outputDir: z.string().optional().describe("저장 디렉토리 (지정 시 파일로 저장, 미지정 시 내용을 직접 반환)"),
      outputName: z.string().optional().describe("저장 파일명 (미지정 시 원본 파일명)"),
    },
    async ({ sharedriveId, fileId, outputDir, outputName }) => {
      try {
        const result = await driveApi.downloadSharedDriveFile(sharedriveId, fileId);

        const fileName = outputName ?? result.fileName ?? fileId;

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
          content: [{ type: "text" as const, text: mcpErrorHint(err, "drive.sharedrive_download") }],
          isError: true,
        };
      }
    }
  );
}
