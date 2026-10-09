import { expectArray, expectRecord, expectString, isVersionToken } from "../util/json.js";
import { sortNewestFirst } from "./compare.js";
import type { Channel, NeoForgeBuild } from "./types.js";

const FIRST_YEAR_VERSION = 26;
const YEAR_BUILD_PARTS = 4;
const LEGACY_BUILD_PARTS = 3;

/** Digits, optionally followed by "-alpha" or "-beta" (with an optional ".N"). Anything else, such as "+snapshot-1", "+pre-3" or "-rc.1", is not a release build. */
const BUILD_VERSION = /^(\d+(?:\.\d+)+)(?:-(?:alpha|beta)(?:\.\d+)?)?$/;

/**
 * Maps a NeoForge version to the Minecraft release it targets.
 * Year-based: "26.2.0.88" is Minecraft 26.2 and "26.1.2.114" is 26.1.2 (third number is the patch).
 * Legacy: "21.1.256" is Minecraft 1.21.1 (first two numbers are minor and patch).
 * Snapshot, pre-release-tagged and April-fools builds have no release mapping.
 */
export function neoForgeMcVersion(version: string): string | undefined {
  const numbers = BUILD_VERSION.exec(version)?.[1]?.split(".").map(Number);
  const [first, second, third] = numbers ?? [];
  if (numbers === undefined || first === undefined || second === undefined || third === undefined) return undefined;

  if (first >= FIRST_YEAR_VERSION) {
    if (numbers.length !== YEAR_BUILD_PARTS) return undefined;
    return third === 0 ? `${first}.${second}` : `${first}.${second}.${third}`;
  }
  if (numbers.length !== LEGACY_BUILD_PARTS) return undefined;
  return second === 0 ? `1.${first}` : `1.${first}.${second}`;
}

/** Stable only when there is no suffix at all; any other suffix counts as a pre-release. */
export function neoForgeChannel(version: string): Channel {
  if (!version.includes("-")) return "stable";
  return version.includes("-beta") ? "beta" : "alpha";
}

/** The highest build number for a Minecraft release. */
export function resolveNeoForge(mcVersion: string, versions: readonly string[]): NeoForgeBuild | undefined {
  const newest = sortNewestFirst(versions.filter((version) => neoForgeMcVersion(version) === mcVersion))[0];
  return newest ? { version: newest, channel: neoForgeChannel(newest) } : undefined;
}

/** Each Minecraft release NeoForge has a build for, newest first. */
export function listNeoForgeMcVersions(versions: readonly string[]): string[] {
  const releases = versions.flatMap((version) => {
    const mcVersion = neoForgeMcVersion(version);
    return mcVersion ? [mcVersion] : [];
  });
  return sortNewestFirst([...new Set(releases)]);
}

/** Every NeoForge version, with entries that are not plain version strings dropped. */
export function parseNeoForgeVersions(json: unknown): string[] {
  const versions = expectRecord(json, "the NeoForge version list").versions;
  return expectArray(versions, "the NeoForge 'versions'")
    .map((version) => expectString(version, "a NeoForge version"))
    .filter((version) => isVersionToken(version));
}
