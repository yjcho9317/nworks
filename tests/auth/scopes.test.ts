import { describe, it, expect } from "vitest";
import {
  resolveScopes,
  mergeScopes,
  expandScopeDependencies,
  SCOPE_PRESETS,
} from "../../src/auth/scopes.js";

describe("resolveScopes", () => {
  it("returns the default preset (all) when input is undefined", () => {
    expect(resolveScopes(undefined)).toEqual(SCOPE_PRESETS.all);
  });

  it("resolves named presets", () => {
    expect(resolveScopes("readonly")).toEqual(SCOPE_PRESETS.readonly);
    expect(resolveScopes("all")).toEqual(SCOPE_PRESETS.all);
    expect(resolveScopes("default")).toEqual(SCOPE_PRESETS.all);
  });

  it("readonly contains only read scopes", () => {
    for (const scope of resolveScopes("readonly")) {
      expect(scope.endsWith(".read")).toBe(true);
    }
  });

  it("treats a non-preset string as a raw scope list and expands dependencies", () => {
    const result = resolveScopes("calendar task");
    // calendar → calendar.read, task → task.read + user.read
    expect(result).toContain("calendar");
    expect(result).toContain("calendar.read");
    expect(result).toContain("task");
    expect(result).toContain("task.read");
    expect(result).toContain("user.read");
  });
});

describe("expandScopeDependencies", () => {
  it("adds the read scope that a write scope depends on", () => {
    expect(expandScopeDependencies(["calendar"])).toContain("calendar.read");
    expect(expandScopeDependencies(["task"])).toEqual(
      expect.arrayContaining(["task", "task.read", "user.read"])
    );
  });

  it("leaves an already-complete set unchanged in membership", () => {
    const input = ["mail.read"];
    expect(expandScopeDependencies(input)).toEqual(["mail.read"]);
  });
});

describe("mergeScopes", () => {
  it("unions existing and requested scopes without duplicates", () => {
    const merged = mergeScopes(["calendar.read"], ["calendar.read", "mail.read"]);
    expect(merged.split(" ").sort()).toEqual(["calendar.read", "mail.read"]);
  });

  it("never narrows: re-login with readonly keeps an existing full-scope token", () => {
    const merged = mergeScopes(SCOPE_PRESETS.all, resolveScopes("readonly"));
    // 기존 all 토큰은 readonly 재로그인 후에도 모든 scope를 유지해야 한다.
    for (const scope of SCOPE_PRESETS.all) {
      expect(merged.split(" ")).toContain(scope);
    }
  });
});
