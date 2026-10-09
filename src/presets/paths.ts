import { hasControlCharacters } from "../util/text.js";

const MAX_PATH_LENGTH = 200;
const FORBIDDEN_FIRST_SEGMENTS: ReadonlySet<string> = new Set([".git"]);

/**
 * A relative POSIX path that stays inside the project: no absolute paths, drive letters,
 * backslashes, "." or ".." segments, empty segments, and nothing under .git.
 */
export function isSafeRelativePath(candidate: string): boolean {
  if (candidate.length === 0 || candidate.length > MAX_PATH_LENGTH) return false;
  if (hasControlCharacters(candidate) || candidate.includes("\\") || candidate.includes(":")) return false;
  if (candidate.startsWith("/")) return false;

  const segments = candidate.split("/");
  const hasBadSegment = segments.some((segment) => segment === "" || segment === "." || segment === "..");
  return !hasBadSegment && !FORBIDDEN_FIRST_SEGMENTS.has((segments[0] ?? "").toLowerCase());
}
