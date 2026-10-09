import { describe, expect, it } from "vitest";
import { isSafeRelativePath } from "../../src/presets/paths.js";

describe("isSafeRelativePath", () => {
  it.each([
    "build.gradle.kts",
    "src/main/java/dev/example/Main.java",
    "gradle/wrapper/gradle-wrapper.properties",
    ".github/workflows/ci.yml",
    ".gitignore",
  ])("accepts %s", (path) => {
    expect(isSafeRelativePath(path)).toBe(true);
  });

  it.each([
    "",
    "/etc/passwd",
    "../outside",
    "a/../b",
    "a//b",
    "a/./b",
    "a\\b",
    "C:/x",
    "x:y",
    ".git/config",
    ".GIT/hooks/pre-commit",
    "a/",
    "a\u0000b",
    "a\nb",
    "a".repeat(201),
  ])("rejects %j", (path) => {
    expect(isSafeRelativePath(path)).toBe(false);
  });
});
