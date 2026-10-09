import type { HttpClient } from "../versions/http.js";
import {
  buildMatrix,
  fetchJavaRequirement,
  fetchSourceData,
  resolveTarget,
  type TargetInfo,
  type VersionMatrix,
} from "../versions/resolver.js";

export interface VersionsArgs {
  /** A Minecraft release to resolve in detail. Omit for the platform overview. */
  mc?: string;
  json: boolean;
}

export async function runVersions(args: VersionsArgs, http: HttpClient): Promise<string> {
  const { data, warnings } = await fetchSourceData(http);

  if (args.mc === undefined) {
    const matrix = buildMatrix(data);
    return args.json ? toJson({ ...matrix, warnings }) : formatMatrix(matrix, warnings);
  }

  const java = await fetchJavaRequirement(http, data.manifest, args.mc);
  const target = resolveTarget(data, args.mc, java);
  const combined: TargetInfo = { ...target, warnings: [...warnings, ...target.warnings] };
  return args.json ? toJson(combined) : formatTarget(combined);
}

export function formatMatrix(matrix: VersionMatrix, warnings: readonly string[]): string {
  const platforms: Array<[string, string | undefined]> = [
    ["Paper", matrix.newestSupported.paper],
    ["Folia", matrix.newestSupported.folia],
    ["Fabric", matrix.newestSupported.fabric],
    ["NeoForge", matrix.newestSupported.neoforge],
    ["Forge", matrix.newestSupported.forge],
  ];
  const lines = [
    `Minecraft ${matrix.minecraft.latestRelease} (newest snapshot ${matrix.minecraft.latestSnapshot})`,
    "",
    "Newest Minecraft release each platform supports:",
    ...platforms.map(([name, version]) => `  ${name.padEnd(9)} ${version ?? "none"}`),
    "",
    "Tools:",
    `  Gradle        ${matrix.tools.gradle}`,
    `  ModDevGradle  ${matrix.tools.moddevgradle}`,
    `  Fabric Loader ${matrix.tools.fabricLoader}`,
    ...(matrix.tools.loom ? [`  Fabric Loom   ${matrix.tools.loom}`] : []),
    ...(matrix.tools.velocityApi ? [`  Velocity API  ${matrix.tools.velocityApi}`] : []),
  ];
  return [...lines, ...formatWarnings(warnings)].join("\n");
}

export function formatTarget(info: TargetInfo): string {
  const javaNote = info.java.source === "mojang" ? "from Mojang" : "assumed, Mojang publishes no value";
  const lines = [
    `Minecraft ${info.mcVersion}  (Java ${info.java.major}, ${javaNote})`,
    "",
    info.paper
      ? `  Paper     paper-api:${info.paper.dependencyVersion}  (newest build ${info.paper.latestBuild})`
      : "  Paper     no API for this version",
    info.folia.available ? "  Folia     available" : `  Folia     not available (newest: ${info.folia.newest ?? "none"})`,
    info.velocity ? `  Velocity  API ${info.velocity.stable}` : "  Velocity  none",
    info.fabric
      ? `  Fabric    loader ${info.fabric.loader}, API ${info.fabric.api ?? "none"}, Loom ${info.fabric.loom ?? "none"} (${info.fabric.loomPluginId})`
      : "  Fabric    not supported",
    info.neoforge ? `  NeoForge  ${info.neoforge.version} (${info.neoforge.channel})` : "  NeoForge  not available",
    info.forge ? `  Forge     ${formatForge(info.forge.latest, info.forge.recommended)}` : "  Forge     not available",
    "",
    `  Gradle ${info.tools.gradle}, ModDevGradle ${info.tools.moddevgradle}`,
  ];
  return [...lines, ...formatWarnings(info.warnings)].join("\n");
}

function formatForge(latest: string | undefined, recommended: string | undefined): string {
  return [latest ? `latest ${latest}` : undefined, recommended ? `recommended ${recommended}` : undefined]
    .filter((part): part is string => part !== undefined)
    .join(", ");
}

function formatWarnings(warnings: readonly string[]): string[] {
  return warnings.length === 0 ? [] : ["", "Warnings:", ...warnings.map((warning) => `  - ${warning}`)];
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
