import { ApiError, AuthError } from "../utils/error.js";
import { getValidUserToken } from "../auth/token-user.js";

const BASE_URL = "https://www.worksapis.com/v1.0";

export interface Assignee {
  assigneeId: string;
  assigneeName?: string;
  status: "TODO" | "DONE";
}

export interface Task {
  taskId: string;
  title: string;
  content: string;
  status: "TODO" | "DONE";
  assignorId: string;
  assignorName?: string;
  assignees: Assignee[];
  completionCondition: "ANY_ONE" | "MUST_ALL";
  dueDate: string | null;
  createdTime: string;
  modifiedTime: string;
}

export interface TaskListResult {
  tasks: Task[];
  responseMetaData?: { nextCursor?: string };
}

export interface TaskCategory {
  categoryId: string;
  categoryName: string;
}

export interface CreateTaskOptions {
  title: string;
  content?: string;
  dueDate?: string;
  categoryId?: string;
  assignorId?: string;
  assigneeIds?: string[];
  userId?: string;
  profile?: string;
}

export interface UpdateTaskOptions {
  taskId: string;
  title?: string;
  content?: string;
  dueDate?: string | null;
  profile?: string;
}

async function authedFetch(
  url: string,
  init: RequestInit,
  profile: string
): Promise<Response> {
  const token = await getValidUserToken(profile);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function handleError(res: Response): Promise<never> {
  if (res.status === 401) {
    throw new AuthError("User token expired. Run `nworks login --user --scope task` again.");
  }
  let code = "UNKNOWN";
  let description = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { code?: string; description?: string };
    code = body.code ?? code;
    description = body.description ?? description;
  } catch {
    // ignore
  }
  throw new ApiError(code, description, res.status);
}

async function resolveUserId(
  userId: string,
  profile: string
): Promise<string> {
  if (userId !== "me") return userId;

  const url = `${BASE_URL}/users/me`;
  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const data = (await res.json()) as { userId: string };
  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] Resolved "me" → ${data.userId}`);
  }
  return data.userId;
}

export async function listCategories(
  userId = "me",
  profile = "default"
): Promise<TaskCategory[]> {
  const url = `${BASE_URL}/users/${userId}/task-categories`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const data = (await res.json()) as { taskCategories: TaskCategory[] };
  return data.taskCategories ?? [];
}

export async function listTasks(
  categoryId = "default",
  userId = "me",
  count = 50,
  cursor?: string,
  status: "TODO" | "ALL" = "ALL",
  profile = "default"
): Promise<TaskListResult> {
  const params = new URLSearchParams();
  params.set("categoryId", categoryId);
  params.set("count", String(count));
  params.set("status", status);
  if (cursor) params.set("cursor", cursor);

  const url = `${BASE_URL}/users/${userId}/tasks?${params.toString()}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  const data = (await res.json()) as TaskListResult;
  return { tasks: data.tasks ?? [], responseMetaData: data.responseMetaData };
}

export async function getTask(
  taskId: string,
  profile = "default"
): Promise<Task> {
  const url = `${BASE_URL}/tasks/${taskId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] GET ${url}`);
  }

  const res = await authedFetch(url, { method: "GET" }, profile);
  if (!res.ok) return handleError(res);

  return (await res.json()) as Task;
}

export async function createTask(opts: CreateTaskOptions): Promise<Task> {
  const userId = opts.userId ?? "me";
  const profile = opts.profile ?? "default";

  const resolvedUserId = await resolveUserId(userId, profile);
  const assignorId = opts.assignorId ?? resolvedUserId;
  const assigneeIds = opts.assigneeIds ?? [resolvedUserId];

  const body: Record<string, unknown> = {
    assignorId,
    assignees: assigneeIds.map((id) => ({ assigneeId: id, status: "TODO" })),
    title: opts.title,
    content: opts.content ?? "",
    completionCondition: "ANY_ONE",
  };
  if (opts.dueDate) body.dueDate = opts.dueDate;
  if (opts.categoryId) body.categoryId = opts.categoryId;

  const url = `${BASE_URL}/users/${userId}/tasks`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
    console.error(`[nworks] Body: ${JSON.stringify(body, null, 2)}`);
  }

  const res = await authedFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    profile
  );

  if (res.status === 201) {
    return (await res.json()) as Task;
  }
  if (!res.ok) return handleError(res);
  return (await res.json()) as Task;
}

export async function updateTask(opts: UpdateTaskOptions): Promise<Task> {
  const profile = opts.profile ?? "default";

  const body: Record<string, unknown> = {};
  if (opts.title !== undefined) body.title = opts.title;
  if (opts.content !== undefined) body.content = opts.content;
  if (opts.dueDate !== undefined) body.dueDate = opts.dueDate;

  const url = `${BASE_URL}/tasks/${opts.taskId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] PATCH ${url}`);
  }

  const res = await authedFetch(
    url,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    profile
  );

  if (!res.ok) return handleError(res);
  return (await res.json()) as Task;
}

export async function completeTask(
  taskId: string,
  profile = "default"
): Promise<void> {
  const url = `${BASE_URL}/tasks/${taskId}/complete`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
  }

  const res = await authedFetch(
    url,
    { method: "POST" },
    profile
  );

  if (res.status === 204) return;
  if (!res.ok) return handleError(res);
}

export async function incompleteTask(
  taskId: string,
  profile = "default"
): Promise<void> {
  const url = `${BASE_URL}/tasks/${taskId}/incomplete`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] POST ${url}`);
  }

  const res = await authedFetch(
    url,
    { method: "POST" },
    profile
  );

  if (res.status === 204) return;
  if (!res.ok) return handleError(res);
}

export async function deleteTask(
  taskId: string,
  profile = "default"
): Promise<void> {
  const url = `${BASE_URL}/tasks/${taskId}`;

  if (process.env["NWORKS_VERBOSE"] === "1") {
    console.error(`[nworks] DELETE ${url}`);
  }

  const res = await authedFetch(
    url,
    { method: "DELETE" },
    profile
  );

  if (res.status === 204) return;
  if (!res.ok) return handleError(res);
}
