import { EmdError } from "../errors.js";
import { isVersionToken } from "../util/json.js";

/** Every upstream the resolver reads. Keep in sync with scripts/record-fixtures.mjs (a test enforces it). */
export const SOURCE_URLS = {
  mojangManifest: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  fillPaper: "https://fill.papermc.io/v3/projects/paper",
  fillFolia: "https://fill.papermc.io/v3/projects/folia",
  paperApiMeta: "https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/maven-metadata.xml",
  velocityApiMeta: "https://repo.papermc.io/repository/maven-public/com/velocitypowered/velocity-api/maven-metadata.xml",
  fabricGame: "https://meta.fabricmc.net/v2/versions/game",
  fabricLoader: "https://meta.fabricmc.net/v2/versions/loader",
  fabricApiMeta: "https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/maven-metadata.xml",
  loomMeta: "https://maven.fabricmc.net/net/fabricmc/fabric-loom/maven-metadata.xml",
  neoForge: "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge",
  forgePromos: "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
  gradle: "https://services.gradle.org/versions/current",
  moddevgradleMeta: "https://plugins.gradle.org/m2/net/neoforged/moddev/net.neoforged.moddev.gradle.plugin/maven-metadata.xml",
} as const;

export type SourceName = keyof typeof SOURCE_URLS;

const VELOCITY_API_DIRECTORY = SOURCE_URLS.velocityApiMeta.slice(0, -"maven-metadata.xml".length);

/**
 * Gradle module metadata for one Velocity API release. It is built per version, so it is not in
 * SOURCE_URLS, but it lives on a host that is. The version is checked so it cannot add a path or query.
 */
export function velocityModuleUrl(version: string): string {
  if (!isVersionToken(version)) {
    throw new EmdError("BAD_URL", `Not a plain Velocity version: ${JSON.stringify(version)}.`);
  }
  return `${VELOCITY_API_DIRECTORY}${version}/velocity-api-${version}.module`;
}

/**
 * The only hosts the HTTP client will contact: exactly the hosts above. Mojang's per-version
 * metadata is served from the manifest's own host, so a manifest entry cannot point anywhere else.
 */
export const ALLOWED_HOSTS: readonly string[] = [...new Set(Object.values(SOURCE_URLS).map((url) => new URL(url).hostname))];
