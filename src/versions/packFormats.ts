import { EmdError } from "../errors.js";
import { expectArray, expectRecord, expectVersion } from "../util/json.js";
import type { PackFormats, PackVersion } from "./types.js";

const MAX_FORMAT = 100_000;

/**
 * Reads misode/mcmeta's list of Minecraft versions, which carries each release's data pack and
 * resource pack format. A release has a major and a minor part since pack formats gained minor
 * versions. Snapshots and releases without a format are left out.
 */
export function parsePackFormats(json: unknown): Map<string, PackFormats> {
  const formats = new Map<string, PackFormats>();
  for (const item of expectArray(json, "the pack format list")) {
    const entry = expectRecord(item, "a pack format entry");
    if (entry.type !== "release" || entry.stable === false) continue;
    const id = expectVersion(entry.id, "a pack format version id");
    const data = readFormat(entry.data_pack_version, entry.data_pack_version_minor, `the data pack format of ${id}`);
    const resource = readFormat(entry.resource_pack_version, entry.resource_pack_version_minor, `the resource pack format of ${id}`);
    if (data && resource) formats.set(id, { data, resource });
  }
  return formats;
}

/** A release without a major format (null) has none to give. A missing minor means 0. */
function readFormat(major: unknown, minor: unknown, what: string): PackVersion | undefined {
  if (major === null || major === undefined) return undefined;
  return { major: wholeNumber(major, what), minor: minor === null || minor === undefined ? 0 : wholeNumber(minor, `${what} (minor)`) };
}

function wholeNumber(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_FORMAT) {
    throw new EmdError("BAD_RESPONSE", `Unexpected response: ${what} should be a whole number from 0 to ${MAX_FORMAT}.`);
  }
  return value;
}
