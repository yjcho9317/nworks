// LINE WORKS OAuth scope는 도메인 단위로 뭉뚱그려져 있다. 예를 들어 `calendar` scope 하나가
// 일정 생성·수정·삭제를 함께 부여하며, 읽기 전용만 `calendar.read`로 분리돼 있다.
// 따라서 "삭제만 제외" 같은 세밀한 프리셋은 scope 수준에서 표현할 수 없고, 축은
// 읽기 전용(readonly) vs 전체(all) 둘뿐이다.
// 메시지 전송은 Service Account(bot) 인증이라 이 프리셋과 무관하게 항상 동작한다.

export type ScopePreset = "readonly" | "default" | "all";

const READ_SCOPES = [
  "calendar.read",
  "file.read",
  "mail.read",
  "task.read",
  "user.read",
  "board.read",
];

const ALL_SCOPES = [
  "calendar",
  "calendar.read",
  "file",
  "file.read",
  "mail",
  "mail.read",
  "task",
  "task.read",
  "user.read",
  "board",
  "board.read",
];

// 쓰기 scope가 의존하는 읽기 scope를 자동 추가한다. 사용자가 직접 좁은 scope를
// 지정했을 때 API 호출이 조용히 실패하지 않도록 보강한다.
// - calendar 쓰기: 수정/삭제 시 기존 일정 조회를 위해 calendar.read 필요
// - task 쓰기·읽기: /users/me 조회를 위해 user.read 필요
const SCOPE_DEPENDENCIES: Record<string, string[]> = {
  calendar: ["calendar.read"],
  file: ["file.read"],
  mail: ["mail.read"],
  task: ["task.read", "user.read"],
  "task.read": ["user.read"],
  board: ["board.read"],
};

export const SCOPE_PRESETS: Record<ScopePreset, string[]> = {
  readonly: READ_SCOPES,
  // default를 all로 두는 이유: 현재 제품의 "한 번 로그인으로 전체 기능" 약속을 보존한다.
  // 읽기 전용을 기본값으로 하면 신규 사용자가 쓰기 기능(일정 생성 등)을 쓸 때 재로그인해야 한다.
  // 안전을 최우선하려면 readonly로 바꾸면 되지만, 삭제류 도구는 이미 destructiveHint
  // annotation으로 클라이언트 승인 게이트가 걸린다.
  default: ALL_SCOPES,
  all: ALL_SCOPES,
};

function isPreset(value: string): value is ScopePreset {
  return value === "readonly" || value === "default" || value === "all";
}

export function expandScopeDependencies(scopes: string[]): string[] {
  const expanded = new Set(scopes);
  for (const scope of scopes) {
    const deps = SCOPE_DEPENDENCIES[scope];
    if (deps) deps.forEach((d) => expanded.add(d));
  }
  return [...expanded];
}

// 프리셋 이름(readonly/default/all) 또는 공백 구분 scope 문자열을 실제 scope 집합으로 해석한다.
export function resolveScopes(input: string | undefined): string[] {
  if (!input) return SCOPE_PRESETS.default;
  if (isPreset(input)) return SCOPE_PRESETS[input];
  // 프리셋이 아니면 사용자가 직접 지정한 scope 문자열로 본다.
  return expandScopeDependencies(input.split(" ").filter(Boolean));
}

// 새로 요청한 scope를 기존 토큰 scope와 합쳐(union) 재로그인 시 권한이 줄지 않게 한다.
export function mergeScopes(existing: string[], requested: string[]): string {
  return [...new Set([...existing, ...requested])].join(" ");
}
