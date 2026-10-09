import { expectArray, expectRecord } from "../util/json.js";
import { compareDotted, isStableMcVersion, isYearVersion, sortNewestFirst } from "./compare.js";
import type { Channel, PaperApiResolution, VelocityApi } from "./types.js";

interface Build {
  version: string;
  build: number;
  channel: Channel;
}

/** Stable Minecraft versions a Fill project (Paper, Folia) publishes builds for, newest first. */
export function parseFillMcVersions(json: unknown): string[] {
  const groups = expectRecord(expectRecord(json, "the Fill project").versions, "the Fill 'versions'");
  const ids = Object.values(groups).flatMap((group) => expectArray(group, "a Fill version group"));
  const stable = ids.filter((id): id is string => typeof id === "string" && isStableMcVersion(id));
  return sortNewestFirst([...new Set(stable)]);
}

/**
 * Paper changed its dependency format at 26.1: `paper-api:26.3.build.+` instead of
 * `paper-api:1.21.11-R0.1-SNAPSHOT`. Returns undefined when Paper has no API for the version.
 */
export function resolvePaperApi(mcVersion: string, mavenVersions: readonly string[]): PaperApiResolution | undefined {
  return isYearVersion(mcVersion) ? resolveBuildVersioned(mcVersion, mavenVersions) : resolveSnapshotVersioned(mcVersion, mavenVersions);
}

/** Velocity ships from the same Maven repository as Paper, but its versions are independent of Minecraft's. */
export function resolveVelocityApi(mavenVersions: readonly string[]): VelocityApi | undefined {
  const stable = sortNewestFirst(mavenVersions.filter((version) => !version.endsWith("-SNAPSHOT")))[0];
  if (!stable) return undefined;
  const snapshot = sortNewestFirst(mavenVersions.filter((version) => version.endsWith("-SNAPSHOT")))[0];
  return snapshot && compareDotted(snapshot, stable) > 0 ? { stable, snapshot } : { stable };
}

function resolveBuildVersioned(mcVersion: string, mavenVersions: readonly string[]): PaperApiResolution | undefined {
  const pattern = new RegExp(`^${escapeRegExp(mcVersion)}\\.build\\.(\\d+)-(alpha|beta|stable)$`);
  const builds = mavenVersions.flatMap((version): Build[] => {
    const match = pattern.exec(version);
    const channel = match?.[2];
    return match && isChannel(channel) ? [{ version, build: Number(match[1]), channel }] : [];
  });

  const newest = newestBuild(builds);
  if (!newest) return undefined;
  const stable = newestBuild(builds.filter((build) => build.channel === "stable"));

  return {
    mcVersion,
    dependencyVersion: `${mcVersion}.build.+`,
    latestBuild: newest.version,
    latestBuildChannel: newest.channel,
    ...(stable ? { latestStable: stable.version } : {}),
  };
}

function resolveSnapshotVersioned(mcVersion: string, mavenVersions: readonly string[]): PaperApiResolution | undefined {
  const dependencyVersion = `${mcVersion}-R0.1-SNAPSHOT`;
  if (!mavenVersions.includes(dependencyVersion)) return undefined;
  return { mcVersion, dependencyVersion, latestBuild: dependencyVersion, latestBuildChannel: "snapshot" };
}

function newestBuild(builds: readonly Build[]): Build | undefined {
  return builds.reduce<Build | undefined>((best, build) => (best === undefined || build.build > best.build ? build : best), undefined);
}

function isChannel(value: string | undefined): value is Channel {
  return value === "stable" || value === "beta" || value === "alpha";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
