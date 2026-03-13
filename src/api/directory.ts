import { request } from "./client.js";

export interface User {
  userId: string;
  userName?: {
    lastName?: string;
    firstName?: string;
  };
  email?: string;
  organizations?: Array<{
    organizationName?: string;
    primary?: boolean;
  }>;
  isAdministrator?: boolean;
  isDeleted?: boolean;
}

export interface UserListResult {
  users: User[];
  responseMetaData?: { nextCursor?: string };
}

export async function listUsers(
  profile = "default"
): Promise<UserListResult> {
  const result = await request<{
    users: User[];
    responseMetaData?: { nextCursor?: string };
  }>({
    method: "GET",
    path: "/users",
    profile,
  });
  return { users: result.users ?? [], responseMetaData: result.responseMetaData };
}
