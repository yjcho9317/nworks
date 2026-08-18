import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as contactApi from "../../api/contact.js";
import { mcpErrorHint } from "../../utils/error-hints.js";
import { defineTool } from "../tool-registry.js";

export function registerContactTools(server: McpServer): void {
  // Tool 22: 연락처 목록
  defineTool(server,
    "nworks_contact_list",
    "NAVER WORKS 개인 연락처 목록을 조회합니다. '연락처 목록 보여줘', '내 명함첩 확인' 등의 요청에 사용. User OAuth 인증 필요 (contact.read scope)",
    {
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
      count: z.number().int().min(1).max(500).optional().describe("페이지당 항목 수 (기본: 20, 최대: 500)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
      contactTagId: z.string().optional().describe("연락처 태그 ID로 필터링 (nworks_contact_list_tags로 조회 가능)"),
      email: z.string().optional().describe("이메일로 필터링"),
      telephone: z.string().optional().describe("전화번호로 필터링"),
    },
    async ({ userId, count, cursor, contactTagId, email, telephone }) => {
      try {
        const result = await contactApi.listContacts({
          userId: userId ?? "me",
          count: count ?? 20,
          cursor,
          contactTagId,
          email,
          telephone,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ contacts: result.contacts, count: result.contacts.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "contact.list") }],
          isError: true,
        };
      }
    }
  );

  // Tool 23: 연락처 상세 조회
  defineTool(server,
    "nworks_contact_get",
    "특정 연락처의 상세 정보를 조회합니다. contactId는 nworks_contact_list로 조회 가능. User OAuth 인증 필요 (contact.read scope)",
    {
      contactId: z.string().describe("연락처 ID (nworks_contact_list로 조회 가능)"),
    },
    async ({ contactId }) => {
      try {
        const result = await contactApi.getContact(contactId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "contact.get") }],
          isError: true,
        };
      }
    }
  );

  // Tool 24: 연락처 생성
  defineTool(server,
    "nworks_contact_create",
    "새 연락처를 만듭니다. '연락처 추가해줘' 등의 요청에 사용. payload는 NAVER WORKS 연락처 API 스펙에 맞는 JSON 객체를 그대로 전달합니다. contactName과 permission은 필수이며, permission.accessibleMembers에는 최소 1명이 있어야 합니다(보통 본인). 예: {\"contactName\":{\"lastName\":\"김\",\"firstName\":\"철수\"},\"emails\":[{\"email\":\"a@b.com\",\"primary\":true}],\"permission\":{\"accessibleRange\":\"MEMBER\",\"isCoEditing\":false,\"accessibleMembers\":[{\"id\":\"<userId>\",\"type\":\"USER\"}]}}. User OAuth 인증 필요 (contact scope)",
    {
      payload: z.record(z.string(), z.unknown()).describe("연락처 필드. 필수: contactName, permission(accessibleRange·isCoEditing·accessibleMembers 최소 1명). 선택: emails[], telephones[], organizations[], memo"),
    },
    async ({ payload }) => {
      try {
        const result = await contactApi.createContact(payload);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "contact.create") }],
          isError: true,
        };
      }
    }
  );

  // Tool 25: 연락처 수정
  defineTool(server,
    "nworks_contact_update",
    "기존 연락처를 수정합니다. contactId는 nworks_contact_list로 조회 가능. payload는 수정할 필드만 담은 JSON 객체입니다. User OAuth 인증 필요 (contact scope)",
    {
      contactId: z.string().describe("연락처 ID (nworks_contact_list로 조회 가능)"),
      payload: z.record(z.string(), z.unknown()).describe("수정할 필드 (name, email, tel, company 등)"),
      replace: z.boolean().optional().describe("전체 교체(PUT) 여부 (기본: false, 부분 수정 PATCH)"),
    },
    async ({ contactId, payload, replace }) => {
      try {
        const result = await contactApi.updateContact(contactId, payload, !(replace ?? false));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "contact.update") }],
          isError: true,
        };
      }
    }
  );

  // Tool 26: 연락처 삭제
  defineTool(server,
    "nworks_contact_delete",
    "연락처를 삭제합니다. contactId는 nworks_contact_list로 조회 가능. User OAuth 인증 필요 (contact scope)",
    {
      contactId: z.string().describe("삭제할 연락처 ID (nworks_contact_list로 조회 가능)"),
    },
    async ({ contactId }) => {
      try {
        await contactApi.deleteContact(contactId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, contactId, message: "연락처가 삭제되었습니다" }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "contact.delete") }],
          isError: true,
        };
      }
    }
  );

  // Tool 27: 연락처 태그 목록
  defineTool(server,
    "nworks_contact_list_tags",
    "연락처 태그(그룹) 목록을 조회합니다. '연락처 태그 목록 보여줘' 등의 요청에 사용. User OAuth 인증 필요 (contact.read scope)",
    {
      userId: z.string().optional().describe("대상 사용자 ID (미지정 시 me)"),
      count: z.number().int().min(1).max(500).optional().describe("페이지당 항목 수 (기본: 20, 최대: 500)"),
      cursor: z.string().optional().describe("페이지네이션 커서"),
    },
    async ({ userId, count, cursor }) => {
      try {
        const result = await contactApi.listContactTags({ userId: userId ?? "me", count: count ?? 20, cursor });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ contactTags: result.contactTags, count: result.contactTags.length, hasMore: !!result.responseMetaData?.nextCursor, nextCursor: result.responseMetaData?.nextCursor ?? null }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: mcpErrorHint(err, "contact.list_tags") }],
          isError: true,
        };
      }
    }
  );
}
