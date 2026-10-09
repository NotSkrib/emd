import { expectArray, expectRecord, expectVersion } from "../util/json.js";
import { isStableMcVersion, isYearVersion, newestStable, sortNewestFirst } from "./compare.js";
import type { LoomPluginId } from "./types.js";

/** Minecraft 26.1 and newer ship unobfuscated, so they use a different Loom plugin than 1.21.11 and older. */
export function loomPluginId(mcVersion: string): LoomPluginId {
  return isYearVersion(mcVersion) ? "net.fabricmc.fabric-loom" : "net.fabricmc.fabric-loom-remap";
}

/** Newest stable Fabric Loader from meta.fabricmc.net/v2/versions/loader. */
export function parseFabricLoader(json: unknown): string {
  const stable = expectArray(json, "the Fabric loader list")
    .map((entry) => expectRecord(entry, "a Fabric loader entry"))
    .find((entry) => entry.stable === true);
  return expectVersion(stable?.version, "the newest stable Fabric loader version");
}

/** Stable Minecraft versions Fabric supports from meta.fabricmc.net/v2/versions/game, newest first. */
export function parseFabricGameVersions(json: unknown): string[] {
  const versions = expectArray(json, "the Fabric game version list").flatMap((entry) => {
    const record = expectRecord(entry, "a Fabric game version entry");
    return record.stable === true && typeof record.version === "string" && isStableMcVersion(record.version)
      ? [record.version]
      : [];
  });
  return sortNewestFirst(versions);
}

/** Fabric API versions end in "+<minecraft version>", for example "0.162.0+26.3". */
export function resolveFabricApi(mcVersion: string, mavenVersions: readonly string[]): string | undefined {
  const matching = mavenVersions.filter((version) => version.includes("+") && version.slice(version.lastIndexOf("+") + 1) === mcVersion);
  return sortNewestFirst(matching)[0];
}

/** Only plain "major.minor.patch" Loom releases count; alpha, rc, pre, dev and snapshot builds do not. */
export function latestStableLoom(mavenVersions: readonly string[]): string | undefined {
  return newestStable(mavenVersions);
}
