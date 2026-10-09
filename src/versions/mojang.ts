import { EmdError } from "../errors.js";
import { expectArray, expectRecord, expectVersion, isVersionToken, type JsonRecord } from "../util/json.js";
import type { JavaRequirement, McRelease, MojangManifest } from "./types.js";

/** Only used if a response lacks `javaVersion`; Mojang publishes it for every release back to 1.0. */
const FALLBACK_JAVA_MAJOR = 8;

export function parseMojangManifest(json: unknown): MojangManifest {
  const root = expectRecord(json, "the Mojang version manifest");
  const latest = expectRecord(root.latest, "the manifest's 'latest'");
  const latestRelease = expectVersion(latest.release, "the latest release id");
  const latestSnapshot = expectVersion(latest.snapshot, "the latest snapshot id");

  const candidates = expectArray(root.versions, "the manifest's 'versions'")
    .map((entry) => expectRecord(entry, "a manifest entry"))
    .filter((entry) => entry.type === "release");
  const releases = candidates
    .flatMap((entry) => {
      const release = toRelease(entry);
      return release ? [release] : [];
    })
    .sort((a, b) => Date.parse(b.releaseTime) - Date.parse(a.releaseTime));

  if (candidates.length > 0 && releases.length === 0) {
    throw new EmdError("BAD_RESPONSE", "Unexpected response: none of the manifest's release entries are usable.");
  }
  return { latestRelease, latestSnapshot, releases };
}

export function parseJavaMajor(json: unknown): JavaRequirement {
  const root = expectRecord(json, "the Mojang version metadata");
  if (root.javaVersion === undefined) return { major: FALLBACK_JAVA_MAJOR, source: "fallback" };

  const major = expectRecord(root.javaVersion, "'javaVersion'").majorVersion;
  if (typeof major !== "number" || !Number.isInteger(major) || major <= 0) {
    throw new EmdError("BAD_RESPONSE", "Unexpected response: 'javaVersion.majorVersion' should be a positive integer.");
  }
  return { major, source: "mojang" };
}

/** An entry with an unsafe id, an unparseable date or no URL is skipped rather than trusted. */
function toRelease(entry: JsonRecord): McRelease | undefined {
  const { id, releaseTime, url } = entry;
  if (typeof id !== "string" || !isVersionToken(id)) return undefined;
  if (typeof releaseTime !== "string" || Number.isNaN(Date.parse(releaseTime))) return undefined;
  if (typeof url !== "string" || url.length === 0) return undefined;
  return { id, releaseTime, versionUrl: url };
}
