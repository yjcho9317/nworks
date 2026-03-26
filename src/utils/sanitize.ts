import { basename, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";

/** 경로 세그먼트에서 /, \, .. 을 차단하여 경로 탈출을 방지한다 */
export function sanitizePathSegment(value: string): string {
  if (!value || typeof value !== "string") {
    throw new Error("Path segment must be a non-empty string");
  }
  if (value === "me") return value;
  if (/[/\\]/.test(value) || value.includes("..")) {
    throw new Error(`Invalid path segment: "${value}"`);
  }
  return encodeURIComponent(value);
}

/** CRLF 헤더 주입 방지를 위해 파일명을 살균한다 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") {
    throw new Error("File name must be a non-empty string");
  }
  const base = basename(name);
  return base.replace(/[\r\n"\\]/g, "_");
}

/** allowedBase 지정 시 해당 디렉토리 하위인지 검증한다 */
export function validateLocalPath(filePath: string, allowedBase?: string): string {
  const resolved = resolve(filePath);

  if (allowedBase) {
    const resolvedBase = resolve(allowedBase);
    if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + sep)) {
      throw new Error(`Path "${filePath}" escapes the allowed directory "${allowedBase}"`);
    }
  }

  return resolved;
}

/** SSRF 방지를 위해 리다이렉트 URL의 호스트를 화이트리스트로 검증한다 */
export function validateRedirectUrl(location: string, allowedHosts: string[]): string {
  let parsed: URL;
  try {
    parsed = new URL(location);
  } catch {
    throw new Error(`Invalid redirect URL: "${location}"`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`Redirect URL must use HTTPS: "${location}"`);
  }

  const isAllowed = allowedHosts.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith("." + host)
  );

  if (!isAllowed) {
    throw new Error(`Redirect to untrusted host: "${parsed.hostname}"`);
  }

  return location;
}

/** crypto.randomBytes 기반 OAuth state 생성 (Math.random 대체) */
export function generateSecureState(): string {
  return randomBytes(32).toString("hex");
}
