# nworks

[![npm version](https://img.shields.io/npm/v/nworks.svg)](https://www.npmjs.com/package/nworks)
[![license](https://img.shields.io/npm/l/nworks.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/nworks.svg)](https://www.npmjs.com/package/nworks)
[![nworks MCP server](https://glama.ai/mcp/servers/yjcho9317/nworks/badges/score.svg)](https://glama.ai/mcp/servers/yjcho9317/nworks)

Featured in [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)

🇺🇸 English | [🇰🇷 한국어](README.ko.md) | [🇯🇵 日本語](README.ja.md)

<p align="center">
  <img src="assets/demo.gif" width="600" alt="nworks demo">
</p>

Full-featured MCP server for LINE WORKS (NAVER WORKS).
CLI + MCP server — 26 tools covering messages, calendar, drive, mail, tasks, and boards.

## Quickstart

```bash
npm install -g nworks
nworks login --user
nworks calendar list
```

### AI Agents Actually Use It Like This

```
User: Show me today's schedule

Claude → nworks_calendar_list
  → 3 events: Standup (10:00), Lunch meeting (12:00), Code review (15:00)

User: Send a deploy complete message to the team channel

Claude → nworks_message_send
  { "channel": "C001", "text": "v1.2.0 deploy complete" }
  → Message sent

User: Check my unread emails and summarize them

Claude → nworks_mail_list (unread)
  → 3 unread emails
Claude → nworks_mail_read (each)
  → "3 unread: 1) Deploy approval from CTO, 2) Meeting invite for Friday, 3) Weekly report reminder"
```

## Install

```bash
npx nworks             # Run directly
npm install -g nworks  # Global install
```

## Login

```bash
# User OAuth (calendar, drive, mail, tasks, boards)
nworks login --user --scope "calendar calendar.read file file.read mail mail.read task task.read board board.read user.read"

# Bot messaging (Service Account)
nworks login

# Check auth status
nworks whoami

# Logout
nworks logout
```

> `nworks login --user` only requires CLIENT_ID + CLIENT_SECRET. Values already set via environment variables or existing config won't be asked again.

> **Developer Console**: To use User OAuth, register `http://localhost:9876/callback` as a Redirect URL in the [Developer Console](https://dev.worksmobile.com/en/).

---

## AI Agent Integration (MCP Server)

Works with Claude Desktop, Cursor, and other MCP-compatible clients.

### Setup

Login first:

```bash
nworks login --user --scope "calendar calendar.read file file.read mail mail.read task task.read board board.read user.read"
```

Then add to your MCP config (`~/.config/claude/claude_desktop_config.json`):

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

One login enables all 26 tools. No extra env setup needed.

> Without CLI login, an AI agent can call `nworks_setup` → `nworks_login_user` to authenticate via browser directly. Client Secret and Private Key path must be pre-configured via MCP config `env` field or system environment variables.

### MCP Tools (26)

| Tool | Description | Auth |
|------|-------------|------|
| **Setup / Auth** | | |
| `nworks_setup` | Configure API credentials (Client ID, etc.). Client Secret is set via env | — |
| `nworks_login_user` | User OAuth browser login (all scopes included) | — |
| `nworks_logout` | Delete credentials and tokens | — |
| `nworks_whoami` | Check auth status | — |
| `nworks_doctor` | Diagnose connection (auth, tokens, API health) | — |
| **Messages** | | |
| `nworks_message_send` | Send message to user/channel | Service Account |
| `nworks_message_members` | List channel members | Service Account |
| `nworks_directory_members` | List organization members | Service Account |
| **Calendar** | | |
| `nworks_calendar_list` | List calendar events | User OAuth (calendar.read) |
| `nworks_calendar_create` | Create calendar event | User OAuth (calendar + calendar.read) |
| `nworks_calendar_update` | Update calendar event | User OAuth (calendar + calendar.read) |
| `nworks_calendar_delete` | Delete calendar event | User OAuth (calendar + calendar.read) |
| **Drive** | | |
| `nworks_drive_list` | List drive files/folders | User OAuth (file.read) |
| `nworks_drive_upload` | Upload file to drive | User OAuth (file) |
| `nworks_drive_download` | Download file (saves locally if >5MB) | User OAuth (file.read) |
| **Mail** | | |
| `nworks_mail_send` | Send mail | User OAuth (mail) |
| `nworks_mail_list` | List mailbox | User OAuth (mail.read) |
| `nworks_mail_read` | Read mail detail | User OAuth (mail.read) |
| **Tasks** | | |
| `nworks_task_list` | List tasks | User OAuth (task.read) |
| `nworks_task_create` | Create task | User OAuth (task + user.read) |
| `nworks_task_update` | Update/complete task | User OAuth (task + user.read) |
| `nworks_task_delete` | Delete task | User OAuth (task + user.read) |
| **Boards** | | |
| `nworks_board_list` | List boards | User OAuth (board.read) |
| `nworks_board_posts` | List board posts | User OAuth (board.read) |
| `nworks_board_read` | Read board post detail | User OAuth (board.read) |
| `nworks_board_create` | Create board post | User OAuth (board) |

### AI Agent Usage Example

```
User: Schedule a meeting tomorrow at 2pm and notify the team channel

Claude → nworks_calendar_create
  { "summary": "Meeting", "start": "2026-03-15T14:00:00", "end": "2026-03-15T15:00:00" }
  → Event created

Claude → nworks_message_send
  { "channel": "C001", "text": "Meeting scheduled tomorrow at 14:00" }
  → Message sent

User: Check my unread emails and summarize them

Claude → nworks_mail_list (unread)
  → 3 unread emails
Claude → nworks_mail_read (each)
  → "3 unread: 1) Deploy approval from CTO, 2) Meeting invite for Friday, 3) Weekly report reminder"
```

---

## CLI Usage

> All commands support `--json` for pipe/script/agent parsing. `message send`, `mail send`, and `drive upload` support `--dry-run` for testing without sending.

### Messages (Bot API)

```bash
# Send text to user
nworks message send --to <userId> --text "Hello"

# Send text to channel
nworks message send --channel <channelId> --text "Announcement"

# Button message
nworks message send --to <userId> --type button --text "PR review request" \
  --actions '[{"type":"message","label":"Approve","postback":"approve"}]'

# List message
nworks message send --to <userId> --type list --text "Today's tasks" \
  --elements '[{"title":"Code review","subtitle":"PR #382"}]'

# List channel members
nworks message members --channel <channelId>
```

### Directory

```bash
nworks directory members   # List organization members
```

### Calendar (User OAuth)

```bash
# List today's events
nworks calendar list

# Specify date range
nworks calendar list --from "2026-03-14T00:00:00+09:00" --until "2026-03-14T23:59:59+09:00"

# Create event
nworks calendar create --title "Meeting" --start "2026-03-14T14:00+09:00" --end "2026-03-14T15:00+09:00"

# With location/description
nworks calendar create --title "Lunch" --start "2026-03-14T12:00+09:00" --end "2026-03-14T13:00+09:00" \
  --location "Conference Room" --description "Quarterly review"

# With attendees + notification
nworks calendar create --title "Team meeting" --start "2026-03-14T10:00+09:00" --end "2026-03-14T11:00+09:00" \
  --attendees "user1@example.com,user2@example.com" --notify

# Update event
nworks calendar update --id <eventId> --title "Updated title"

# Delete event
nworks calendar delete --id <eventId>
```

### Drive (User OAuth)

```bash
# List files/folders
nworks drive list

# Upload file
nworks drive upload --file ./report.pdf

# Upload to specific folder
nworks drive upload --file ./report.pdf --folder <folderId>

# Download file
nworks drive download --file-id <fileId>

# Specify output path/name
nworks drive download --file-id <fileId> --out ./downloads --name report.pdf
```

### Mail (User OAuth)

```bash
# Send mail
nworks mail send --to "user@example.com" --subject "Subject" --body "Body"

# With CC/BCC
nworks mail send --to "user@example.com" --cc "cc@example.com" --subject "Subject" --body "Body"

# List inbox
nworks mail list

# Unread only
nworks mail list --unread

# Read mail detail
nworks mail read --id <mailId>
```

### Tasks (User OAuth)

```bash
# List tasks
nworks task list

# Incomplete only
nworks task list --status TODO

# Create task
nworks task create --title "Code review" --body "Review PR #382"

# With due date
nworks task create --title "Deploy" --due 2026-03-20

# Mark as done
nworks task update --id <taskId> --status done

# Delete task
nworks task delete --id <taskId>
```

### Boards (User OAuth)

```bash
# List boards
nworks board list

# List posts
nworks board posts --board <boardId>

# Read post detail
nworks board read --board <boardId> --post <postId>

# Create post
nworks board create --board <boardId> --title "Announcement" --body "Content"

# With notification + disable comments
nworks board create --board <boardId> --title "Notice" --body "Content" --notify --no-comment
```

### CI/CD Deploy Notification

```bash
# Notify team channel after deployment in GitHub Actions
nworks message send --channel $CHANNEL_ID --text "v${VERSION} deployed"
```

### Team Automation Script

```bash
# Send daily standup reminder to all members
for userId in $(nworks directory members --json | jq -r '.users[].userId'); do
  nworks message send --to "$userId" --text "Standup at 10:00 today"
done
```

---

## OAuth Scopes

Add the required scopes in the [LINE WORKS Developer Console](https://dev.worksmobile.com/en/).

| Scope | Purpose | Auth | Required For |
|-------|---------|------|-------------|
| `bot` | Bot messaging | Service Account | `message send` |
| `bot.read` | Bot channel/member read | Service Account | `message members` |
| `calendar` | Calendar write | User OAuth | `calendar create/update/delete` (requires calendar.read) |
| `calendar.read` | Calendar read | User OAuth | `calendar list`, also needed for calendar write |
| `file` | Drive read/write | User OAuth | `drive list/upload/download` |
| `file.read` | Drive read-only | User OAuth | `drive list/download` |
| `mail` | Mail read/write | User OAuth | `mail send/list/read` |
| `mail.read` | Mail read-only | User OAuth | `mail list/read` |
| `task` | Tasks read/write | User OAuth | `task create/update/delete` (requires user.read) |
| `task.read` | Tasks read-only | User OAuth | `task list` |
| `user.read` | User info read | Service Account / User OAuth | `directory members`, also needed for task write |
| `board` | Boards read/write | User OAuth | `board list/posts/read/create` |
| `board.read` | Boards read-only | User OAuth | `board list/posts/read` |

> **Tip**: After changing scopes, reissue your token:
> ```bash
> nworks logout && nworks login --user --scope "..."
> ```

---

## Environment Variables

Set environment variables to use nworks without `nworks login` (useful for CI/agents).

```bash
# Required
NWORKS_CLIENT_ID=
NWORKS_CLIENT_SECRET=

# Bot messaging only (not needed for User OAuth)
NWORKS_SERVICE_ACCOUNT=
NWORKS_PRIVATE_KEY_PATH=
NWORKS_BOT_ID=

# Optional
NWORKS_DOMAIN_ID=
NWORKS_SCOPE=              # default: bot bot.read user.read
NWORKS_VERBOSE=1           # debug logging
```

### MCP Server with Environment Variables

Sensitive values (Client Secret, Private Key path) must be set via MCP config `env` field. Non-sensitive values like Client ID can be configured by the AI agent through the `nworks_setup` tool.

```json
{
  "mcpServers": {
    "nworks": {
      "command": "npx",
      "args": ["-y", "nworks", "mcp"],
      "env": {
        "NWORKS_CLIENT_SECRET": "<Client Secret>",
        "NWORKS_PRIVATE_KEY_PATH": "<Private Key file absolute path (for Service Account)>"
      }
    }
  }
}
```

---

## License

Apache-2.0
