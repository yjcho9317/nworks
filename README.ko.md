# nworks

[![npm version](https://img.shields.io/npm/v/nworks.svg)](https://www.npmjs.com/package/nworks)
[![license](https://img.shields.io/npm/l/nworks.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/nworks.svg)](https://www.npmjs.com/package/nworks)
[![nworks MCP server](https://glama.ai/mcp/servers/yjcho9317/nworks/badges/score.svg)](https://glama.ai/mcp/servers/yjcho9317/nworks)

Featured in [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)

[🇺🇸 English](README.md) | 🇰🇷 한국어 | [🇯🇵 日本語](README.ja.md)

<p align="center">
  <img src="assets/demo.gif" width="600" alt="nworks demo">
</p>

NAVER WORKS (LINE WORKS) 최초의 MCP 서버.
메시지, 캘린더, 드라이브, 메일, 할 일, 게시판 — 26개 도구를 CLI와 AI 에이전트에서 쓸 수 있습니다.

## Quickstart

```bash
npm install -g nworks
nworks login --user
nworks calendar list
```

### AI 에이전트가 실제로 이렇게 씁니다

```
User: 오늘 일정 알려줘

Claude → nworks_calendar_list
  → 3건: 스탠드업(10:00), 점심미팅(12:00), 코드리뷰(15:00)

User: 팀 채널에 배포 완료 메시지 보내줘

Claude → nworks_message_send
  { "channel": "C001", "text": "v1.2.0 배포 완료" }
  → 메시지가 전송되었습니다

User: 읽지 않은 메일 확인하고 요약해줘

Claude → nworks_mail_list (unread)
  → 읽지 않은 메일 3통
Claude → nworks_mail_read (각각)
  → "3통: 1) CTO 배포 승인, 2) 금요일 회의 초대, 3) 주간 보고 리마인더"
```

## Install

```bash
npx nworks             # 바로 실행
npm install -g nworks  # 글로벌 설치
```

## 로그인

```bash
# User OAuth (캘린더, 드라이브, 메일, 할 일, 게시판)
nworks login --user --scope "calendar calendar.read file file.read mail mail.read task task.read board board.read user.read"

# 봇 메시지 전송이 필요한 경우 (Service Account)
nworks login

# 인증 확인
nworks whoami

# 로그아웃
nworks logout
```

> `nworks login --user`는 CLIENT_ID + CLIENT_SECRET만 있으면 됩니다. 환경변수나 기존 설정에 이미 있는 값은 다시 물어보지 않습니다.

> **Developer Console 설정**: User OAuth를 사용하려면 [Developer Console](https://dev.worksmobile.com)에서 Redirect URL에 `http://localhost:9876/callback`을 등록해야 합니다.

---

## AI 에이전트 연동 (MCP 서버)

Claude Desktop, Cursor 등 MCP 호환 클라이언트에서 사용할 수 있습니다.

### 설정

먼저 로그인합니다:

```bash
nworks login --user --scope "calendar calendar.read file file.read mail mail.read task task.read board board.read user.read"
```

그리고 MCP 설정에 추가합니다 (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nworks": {
      "command": "nworks",
      "args": ["mcp"]
    }
  }
}
```

로그인 한 번이면 26개 도구 모두 사용 가능. 별도 env 설정 불필요.

> **MCP에서 AI 에이전트가 직접 설정하기**: CLI 로그인 없이도 AI 에이전트가 `nworks_setup` → `nworks_login_user` 순서로 호출하면 브라우저 로그인만으로 전체 기능을 사용할 수 있습니다. Client Secret과 Private Key 경로는 MCP 설정의 `env` 필드 또는 시스템 환경변수로 미리 설정해야 합니다.

### MCP 도구 목록 (26개)

| 도구 | 설명 | 필요 인증 |
|------|------|----------|
| **설정/인증** | | |
| `nworks_setup` | API 인증 정보 설정 (Client ID 등). Client Secret은 환경변수로 설정 | — |
| `nworks_login_user` | User OAuth 브라우저 로그인 (전체 scope 자동 포함) | — |
| `nworks_logout` | 인증 정보 및 토큰 삭제 | — |
| `nworks_whoami` | 인증 상태 확인 | — |
| `nworks_doctor` | 연결 상태 진단 (인증, 토큰, API 점검) | — |
| **메시지** | | |
| `nworks_message_send` | 사용자/채널에 메시지 전송 | Service Account |
| `nworks_message_members` | 채널 구성원 조회 | Service Account |
| `nworks_directory_members` | 조직 구성원 조회 | Service Account |
| **캘린더** | | |
| `nworks_calendar_list` | 캘린더 일정 조회 | User OAuth (calendar.read) |
| `nworks_calendar_create` | 캘린더 일정 생성 | User OAuth (calendar + calendar.read) |
| `nworks_calendar_update` | 캘린더 일정 수정 | User OAuth (calendar + calendar.read) |
| `nworks_calendar_delete` | 캘린더 일정 삭제 | User OAuth (calendar + calendar.read) |
| **드라이브** | | |
| `nworks_drive_list` | 드라이브 파일/폴더 목록 | User OAuth (file.read) |
| `nworks_drive_upload` | 드라이브 파일 업로드 | User OAuth (file) |
| `nworks_drive_download` | 드라이브 파일 다운로드 (5MB 초과 시 로컬 저장) | User OAuth (file.read) |
| **메일** | | |
| `nworks_mail_send` | 메일 전송 | User OAuth (mail) |
| `nworks_mail_list` | 메일 목록 조회 | User OAuth (mail.read) |
| `nworks_mail_read` | 메일 상세 조회 | User OAuth (mail.read) |
| **할 일** | | |
| `nworks_task_list` | 할 일 목록 조회 | User OAuth (task.read) |
| `nworks_task_create` | 할 일 생성 | User OAuth (task + user.read) |
| `nworks_task_update` | 할 일 수정/완료 | User OAuth (task + user.read) |
| `nworks_task_delete` | 할 일 삭제 | User OAuth (task + user.read) |
| **게시판** | | |
| `nworks_board_list` | 게시판 목록 조회 | User OAuth (board.read) |
| `nworks_board_posts` | 게시판 글 목록 조회 | User OAuth (board.read) |
| `nworks_board_read` | 게시판 글 상세 조회 | User OAuth (board.read) |
| `nworks_board_create` | 게시판 글 작성 | User OAuth (board) |

### AI 에이전트 사용 예시

```
User: 내일 오후 2시에 회의 잡고, 팀 채널에 알려줘

Claude → nworks_calendar_create
  { "summary": "회의", "start": "2026-03-15T14:00:00", "end": "2026-03-15T15:00:00" }
  → 일정이 생성되었습니다

Claude → nworks_message_send
  { "channel": "C001", "text": "내일 14:00 회의가 잡혔습니다" }
  → 메시지가 전송되었습니다

User: 읽지 않은 메일 확인하고 요약해줘

Claude → nworks_mail_list (unread)
  → 읽지 않은 메일 3통
Claude → nworks_mail_read (각각)
  → "3통: 1) CTO 배포 승인, 2) 금요일 회의 초대, 3) 주간 보고 리마인더"
```

---

## CLI 사용법

> 모든 명령어에 `--json` 지원 (파이프, 스크립트, 에이전트 파싱 용이). `message send`, `mail send`, `drive upload`는 `--dry-run`으로 실제 전송 없이 테스트 가능.

### 메시지 (Bot API)

```bash
# 사용자에게 텍스트 메시지
nworks message send --to <userId> --text "메시지"

# 채널에 텍스트 메시지
nworks message send --channel <channelId> --text "메시지"

# 버튼 메시지
nworks message send --to <userId> --type button --text "PR 리뷰 요청" \
  --actions '[{"type":"message","label":"승인","postback":"approve"}]'

# 리스트 메시지
nworks message send --to <userId> --type list --text "오늘의 할 일" \
  --elements '[{"title":"코드 리뷰","subtitle":"#382 PR"}]'

# 채널 구성원 조회
nworks message members --channel <channelId>
```

### 조직 (Directory API)

```bash
nworks directory members   # 조직 구성원 목록
```

### 캘린더 (User OAuth)

```bash
# 오늘 일정 조회
nworks calendar list

# 기간 지정
nworks calendar list --from "2026-03-14T00:00:00+09:00" --until "2026-03-14T23:59:59+09:00"

# 일정 생성
nworks calendar create --title "회의" --start "2026-03-14T14:00+09:00" --end "2026-03-14T15:00+09:00"

# 장소/설명 포함
nworks calendar create --title "점심 미팅" --start "2026-03-14T12:00+09:00" --end "2026-03-14T13:00+09:00" \
  --location "강남 식당" --description "분기 리뷰"

# 참석자 지정 + 알림
nworks calendar create --title "팀 회의" --start "2026-03-14T10:00+09:00" --end "2026-03-14T11:00+09:00" \
  --attendees "user1@example.com,user2@example.com" --notify

# 일정 수정
nworks calendar update --id <eventId> --title "변경된 제목"

# 일정 삭제
nworks calendar delete --id <eventId>
```

### 드라이브 (User OAuth)

```bash
# 파일/폴더 목록
nworks drive list

# 파일 업로드
nworks drive upload --file ./report.pdf

# 특정 폴더에 업로드
nworks drive upload --file ./report.pdf --folder <folderId>

# 파일 다운로드
nworks drive download --file-id <fileId>

# 다운로드 경로/파일명 지정
nworks drive download --file-id <fileId> --out ./downloads --name report.pdf
```

### 메일 (User OAuth)

```bash
# 메일 전송
nworks mail send --to "user@example.com" --subject "제목" --body "내용"

# CC/BCC 포함
nworks mail send --to "user@example.com" --cc "cc@example.com" --subject "제목" --body "내용"

# 받은편지함 목록
nworks mail list

# 읽지 않은 메일만
nworks mail list --unread

# 메일 상세 조회
nworks mail read --id <mailId>
```

### 할 일 (User OAuth)

```bash
# 할 일 목록
nworks task list

# 미완료만 조회
nworks task list --status TODO

# 할 일 생성
nworks task create --title "코드 리뷰" --body "PR #382 리뷰"

# 마감일 지정
nworks task create --title "배포" --due 2026-03-20

# 할 일 완료 처리
nworks task update --id <taskId> --status done

# 할 일 삭제
nworks task delete --id <taskId>
```

### 게시판 (User OAuth)

```bash
# 게시판 목록
nworks board list

# 게시판 글 목록
nworks board posts --board <boardId>

# 글 상세 조회
nworks board read --board <boardId> --post <postId>

# 글 작성
nworks board create --board <boardId> --title "공지사항" --body "내용"

# 알림 발송 + 댓글 비활성화
nworks board create --board <boardId> --title "공지" --body "내용" --notify --no-comment
```

### CI/CD 배포 알림

```bash
# GitHub Actions에서 배포 완료 후 팀 채널에 알림
nworks message send --channel $CHANNEL_ID --text "v${VERSION} 배포 완료"
```

### 팀 자동화 스크립트

```bash
# 매일 아침 팀원에게 리마인더 전송
for userId in $(nworks directory members --json | jq -r '.users[].userId'); do
  nworks message send --to "$userId" --text "오늘의 스탠드업 10시입니다"
done
```

---

## OAuth Scope 설정

[NAVER WORKS Developer Console](https://dev.worksmobile.com)에서 앱의 OAuth Scope를 추가해야 합니다.

| Scope | 용도 | 인증 방식 | 필요한 명령어 |
|-------|------|----------|--------------|
| `bot` | Bot 메시지 전송 | Service Account | `message send` |
| `bot.read` | Bot 채널/구성원 조회 | Service Account | `message members` |
| `calendar` | 캘린더 쓰기 | User OAuth | `calendar create/update/delete` (calendar.read도 함께 필요) |
| `calendar.read` | 캘린더 읽기 | User OAuth | `calendar list`, `calendar create/update/delete`의 의존성 |
| `file` | 드라이브 읽기/쓰기 | User OAuth | `drive list/upload/download` |
| `file.read` | 드라이브 읽기 전용 | User OAuth | `drive list/download` |
| `mail` | 메일 읽기/쓰기 | User OAuth | `mail send/list/read` |
| `mail.read` | 메일 읽기 전용 | User OAuth | `mail list/read` |
| `task` | 할 일 읽기/쓰기 | User OAuth | `task create/update/delete` (user.read도 함께 필요) |
| `task.read` | 할 일 읽기 전용 | User OAuth | `task list` |
| `user.read` | 사용자 정보 조회 | Service Account / User OAuth | `directory members`, `task create/update/delete`의 의존성 |
| `board` | 게시판 읽기/쓰기 | User OAuth | `board list/posts/read/create` |
| `board.read` | 게시판 읽기 전용 | User OAuth | `board list/posts/read` |

> **Tip**: scope를 변경한 후에는 토큰을 재발급해야 합니다.
> ```bash
> nworks logout && nworks login --user --scope "..."
> ```

---

## 환경 변수

환경변수로 인증 정보를 설정하면 `nworks login` 없이 바로 사용할 수 있습니다 (CI/에이전트용).

```bash
# 공통 (필수)
NWORKS_CLIENT_ID=
NWORKS_CLIENT_SECRET=

# 봇 메시지 전송 시에만 필요 (User OAuth만 쓰면 불필요)
NWORKS_SERVICE_ACCOUNT=
NWORKS_PRIVATE_KEY_PATH=
NWORKS_BOT_ID=

# 선택
NWORKS_DOMAIN_ID=
NWORKS_SCOPE=              # 기본: bot bot.read user.read
NWORKS_VERBOSE=1           # 디버그 로깅
```

### MCP 서버에 환경 변수 직접 설정

민감 정보(Client Secret, Private Key 경로)는 MCP 설정의 `env` 필드로 설정합니다. Client ID 등 민감하지 않은 값은 AI 에이전트가 `nworks_setup` tool로 직접 설정할 수 있습니다.

```json
{
  "mcpServers": {
    "nworks": {
      "command": "npx",
      "args": ["-y", "nworks", "mcp"],
      "env": {
        "NWORKS_CLIENT_SECRET": "<Client Secret>",
        "NWORKS_PRIVATE_KEY_PATH": "<Private Key 파일 절대 경로 (Service Account 사용 시)>"
      }
    }
  }
}
```

---

## License

Apache-2.0
