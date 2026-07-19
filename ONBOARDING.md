# nworks Onboarding & Admin Setup

> The hardest part of getting started is **not** the terminal — it is creating a
> LINE WORKS / NAVER WORKS Developer Console app and getting the right admin
> permissions. This guide walks through that, plus the scope presets and safety
> notes.

## Where nworks fits

LINE WORKS ships its own in‑product AI (AiStudio, WORKS AI). Those run **inside**
LINE WORKS. nworks is the opposite direction: it lets an **external** AI agent
(Claude, Cursor, …) or your terminal **operate** LINE WORKS from the outside.
They do not compete — you can use both.

nworks is an unofficial, community project and is not affiliated with or endorsed
by LINE WORKS / NAVER WORKS.

## Prerequisites (do this first)

1. **A LINE WORKS / NAVER WORKS account** on a plan that allows Developer Console
   / API access. If you are not sure your plan includes API access, confirm with
   your workspace admin before continuing.
2. **A Developer Console app** at <https://dev.worksmobile.com>:
   - Create an app and note the **Client ID** and **Client Secret**.
   - Register the OAuth **Redirect URI**: `http://localhost:9876/callback`.
   - For bot messaging (Service Account): create a Bot, note the **Bot ID**, and
     download the **Service Account private key** (`.key`).
3. **Admin approval of scopes.** Some scopes and the bot must be approved/enabled
   by a workspace administrator. If you are not an admin, send them the request
   template below.

### "Ask your admin" request template

```
Subject: Approval for a LINE WORKS Developer Console app (nworks)

Hi <admin>,

I'd like to connect our LINE WORKS workspace to an AI assistant / automation
using an open-source tool called nworks (https://github.com/yjcho9317/nworks).

Could you please:
  1. Confirm our plan allows Developer Console / API access.
  2. Approve a Developer Console app with these OAuth scopes:
       - Read only to start:  calendar.read, mail.read, task.read, board.read,
                              file.read, user.read
       - (Optional, for writing) calendar, mail, task, board, file
  3. (For bot messages) enable a Bot and share the Bot ID + Service Account key.

The redirect URL the tool uses is: http://localhost:9876/callback
Tokens are stored locally on my machine only; nothing is sent to any third party.

Thanks!
```

## Scope presets

OAuth scopes in LINE WORKS are **coarse**: the `calendar` scope grants create +
update + delete together, and read-only is a separate `calendar.read`. So access
comes in two meaningful levels, exposed as presets:

| Preset      | What it grants                                              |
| ----------- | ---------------------------------------------------------- |
| `readonly`  | Read-only: `*.read` + `user.read`                          |
| `all`       | Full: read **and** write/delete for every domain           |
| `default`   | Currently an alias of `all` (one login = full functionality) |

- **CLI:** `nworks login --user --preset readonly` (or `--preset all`).
  Advanced: `--scope "calendar calendar.read"` for a hand-picked set.
- **MCP:** the `nworks_login_user` tool takes an optional `preset` argument.

Message sending uses the **Service Account (bot)**, which is independent of these
User-OAuth presets — it works regardless of which preset you pick.

**Re-login never narrows access.** New scopes are merged (union) with whatever the
existing token already had, so switching presets can only add capability, never
silently drop it.

## Safety notes

- **Tool annotations are hints, not a security boundary.** nworks marks
  destructive tools (delete event/task, logout, …) with `destructiveHint` and
  read tools with `readOnlyHint` so MCP clients can gate them. Clients are free to
  ignore these — do not rely on them as an access control.
- **Local token files.** Credentials and tokens live as JSON under
  `~/.config/nworks`. On Unix they are written with `0600` (dir `0700`). On
  Windows, permissions rely on your home-directory ACLs. `0600` does **not**
  protect against another process running as the **same** OS user.
- **Keep the private key out of your project folder.** A `.key` inside a repo or
  working directory can be exposed by editor plugins, AI tools, or `npm pack`.
  Store it somewhere like your home directory and point `NWORKS_PRIVATE_KEY_PATH`
  at it. `nworks doctor` warns when the key is inside the working directory.

## Verify your setup

```
nworks doctor
```

It checks credentials, key file + location, tokens, and live API connectivity, and
exits non-zero if anything fails — handy in scripts and CI.
