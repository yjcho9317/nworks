# Security Policy

## Supported Versions

Only the latest published version on npm receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a Vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting instead:
**[Report a vulnerability](https://github.com/yjcho9317/nworks/security/advisories/new)**
(repository **Security** tab → **Report a vulnerability**).

If you cannot use that channel, email **youngjin317@gmail.com** with the details.

Please include:
- affected version and platform (OS, Node.js version),
- reproduction steps or a proof of concept,
- the impact you foresee.

You can expect an initial response within a few days. Once a fix is
released, you are credited in the release notes unless you prefer to
stay anonymous.

## Scope Notes

nworks stores credentials and OAuth tokens as JSON under `~/.config/nworks`.
On Unix these files are written with `0600` permissions and the directory
with `0700`. On Windows, file permissions rely on the user's home-directory
ACLs — treat the machine account as the trust boundary. These `0600`
permissions do not protect against another process running as the **same**
OS user; that is an accepted limitation, not a vulnerability.
