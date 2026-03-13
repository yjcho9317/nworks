import { ApiError, AuthError } from "../utils/error.js";
import { cliErrorHint } from "../utils/error-hints.js";
import { errorOutput } from "./format.js";

/**
 * Standard CLI error handler with Korean hints.
 * Use in command catch blocks: `cliError(err, opts, "calendar.list")`
 */
export function cliError(
  err: unknown,
  opts: { json?: boolean } = {},
  area?: string,
): void {
  const error = err as Error;

  if (error instanceof ApiError) {
    errorOutput(
      {
        code: error.code,
        message: error.message,
        hint: cliErrorHint(err, area).split("\n").slice(1).map((l) => l.replace(/^\s+→\s*/, "")).join(" "),
      },
      opts,
    );
  } else if (error instanceof AuthError) {
    errorOutput(
      {
        code: "AUTH_ERROR",
        message: error.message,
        hint: "인증이 만료됐습니다. `nworks login`으로 다시 로그인하세요.",
      },
      opts,
    );
  } else {
    errorOutput({ message: error.message }, opts);
  }

  process.exitCode = 1;
}
