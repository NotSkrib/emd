/** Minecraft switched from "1.x" to year-based versions ("26.1") with the 26.1 release. */
const FIRST_YEAR_VERSION = 26;
const STABLE_SEMVER = /^\d+\.\d+\.\d+$/;

interface SplitVersion {
  base: number[];
  /** Integers after the first "-", or undefined when the version has no suffix. */
  suffix: number[] | undefined;
}

/**
 * Compares by the integers in each string, so "1.21.10" is newer than "1.21.9" and a longer
 * version beats its prefix. Digits after the first "-" only break ties, and a version outranks its
 * own pre-releases: "1.19.0" is newer than "1.19.0-rc.1".
 */
export function compareDotted(a: string, b: string): number {
  const left = splitVersion(a);
  const right = splitVersion(b);
  const byBase = compareNumbers(left.base, right.base);
  if (byBase !== 0) return byBase;

  if (left.suffix === undefined && right.suffix === undefined) return 0;
  if (left.suffix === undefined) return 1;
  if (right.suffix === undefined) return -1;
  return compareNumbers(left.suffix, right.suffix);
}

export function sortNewestFirst(versions: readonly string[]): string[] {
  return [...versions].sort((a, b) => compareDotted(b, a));
}

/** The newest plain "major.minor.patch" version. Anything with a suffix, such as -rc.1 or -SNAPSHOT, is ignored. */
export function newestStable(versions: readonly string[]): string | undefined {
  return sortNewestFirst(versions.filter((version) => STABLE_SEMVER.test(version)))[0];
}

export function isYearVersion(mcVersion: string): boolean {
  const major = Number(/^\d+/.exec(mcVersion)?.[0]);
  return Number.isInteger(major) && major >= FIRST_YEAR_VERSION;
}

/** What `--mc` can say instead of a version: the newest release. Only the commands that accept it resolve it. */
export const LATEST_MINECRAFT = "latest";

/** True for release ids such as "26.3" and "1.21.11", false for pre-releases and snapshots. */
export function isStableMcVersion(id: string): boolean {
  return /^\d+(\.\d+){1,2}$/.test(id);
}

function splitVersion(version: string): SplitVersion {
  const dash = version.indexOf("-");
  if (dash === -1) return { base: numbersIn(version), suffix: undefined };
  return { base: numbersIn(version.slice(0, dash)), suffix: numbersIn(version.slice(dash + 1)) };
}

function compareNumbers(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const l = left[index];
    const r = right[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}

function numbersIn(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}
