import { EmdError } from "../errors.js";
import { parseJsonText } from "../util/json.js";
import { compareDotted, newestStable, sortNewestFirst } from "./compare.js";
import {
  latestStableLoom,
  loomPluginId,
  parseFabricGameVersions,
  parseFabricLoader,
  resolveFabricApi,
} from "./fabric.js";
import { parseForgePromos } from "./forge.js";
import { parseGradleModule } from "./gradleModule.js";
import { parseGradleVersion } from "./gradle.js";
import type { HttpClient } from "./http.js";
import { parseMavenVersions } from "./maven.js";
import { parseJavaMajor, parseMojangManifest } from "./mojang.js";
import {
  listNeoForgeMcVersions,
  neoForgeChannel,
  neoForgeMcVersion,
  parseNeoForgeVersions,
  resolveNeoForge,
} from "./neoforge.js";
import { parseFillMcVersions, resolvePaperApi, resolveVelocityApi } from "./paper.js";
import { SOURCE_URLS, velocityModuleUrl, type SourceName } from "./sources.js";
import type {
  FabricTarget,
  ForgeBuilds,
  ForgePromos,
  JavaRequirement,
  MojangManifest,
  NeoForgeBuild,
  PaperApiResolution,
  VelocityApi,
} from "./types.js";

/**
 * Below this, platforms publish under older artifact names or version schemes (Paper's old group,
 * Fabric API's lowest-compatible suffix, NeoForge's `forge` artifact), so "missing" can be wrong.
 */
const RESOLVER_FLOOR = "1.20.5";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Everything parsed from the upstream APIs, before any Minecraft version is chosen. */
export interface SourceData {
  manifest: MojangManifest;
  paperMcVersions: string[];
  foliaMcVersions: string[];
  paperApiVersions: string[];
  velocityApiVersions: string[];
  fabricGameVersions: string[];
  fabricLoader: string;
  fabricApiVersions: string[];
  loomVersions: string[];
  neoForgeVersions: string[];
  forgePromos: ForgePromos;
  gradle: string;
  moddevgradle: string;
}

export interface VersionMatrix {
  minecraft: { latestRelease: string; latestSnapshot: string };
  /** Newest released Minecraft version each platform has a build for. */
  newestSupported: { paper?: string; folia?: string; fabric?: string; neoforge?: string; forge?: string };
  tools: { gradle: string; moddevgradle: string; loom?: string; fabricLoader: string; velocityApi?: string };
}

export interface PlatformSupport {
  available: boolean;
  /** Newest Minecraft release the platform supports, whether or not the requested one is available. */
  newest?: string;
}

export interface TargetInfo {
  mcVersion: string;
  java: JavaRequirement;
  paper?: PaperApiResolution;
  folia: PlatformSupport;
  velocity?: VelocityApi;
  fabric?: FabricTarget;
  neoforge?: NeoForgeBuild;
  forge?: ForgeBuilds;
  tools: { gradle: string; moddevgradle: string };
  warnings: string[];
}

interface Loaded<T> {
  name: SourceName;
  value: T;
  stale: boolean;
  ageMs: number | undefined;
}

/**
 * Fetches and parses every source. A body is parsed before it is cached, so a proxy's error page
 * never becomes "fresh" data, and a source that parses to nothing is an error rather than an empty list.
 */
export async function fetchSourceData(http: HttpClient): Promise<{ data: SourceData; warnings: string[] }> {
  const loaded = await Promise.all([
    load(http, "mojangManifest", fromJson("mojangManifest", parseMojangManifest)),
    load(http, "fillPaper", fromJson("fillPaper", (json) => nonEmpty(parseFillMcVersions(json), "fillPaper"))),
    load(http, "fillFolia", fromJson("fillFolia", (json) => nonEmpty(parseFillMcVersions(json), "fillFolia"))),
    load(http, "paperApiMeta", mavenVersions("paperApiMeta")),
    load(http, "velocityApiMeta", mavenVersions("velocityApiMeta")),
    load(http, "fabricGame", fromJson("fabricGame", (json) => nonEmpty(parseFabricGameVersions(json), "fabricGame"))),
    load(http, "fabricLoader", fromJson("fabricLoader", parseFabricLoader)),
    load(http, "fabricApiMeta", mavenVersions("fabricApiMeta")),
    load(http, "loomMeta", mavenVersions("loomMeta")),
    load(http, "neoForge", fromJson("neoForge", (json) => nonEmpty(parseNeoForgeVersions(json), "neoForge"))),
    load(http, "forgePromos", fromJson("forgePromos", parseNonEmptyForgePromos)),
    load(http, "gradle", fromJson("gradle", parseGradleVersion)),
    load(http, "moddevgradleMeta", (body) => requireStable(parseMavenVersions(body), "moddevgradleMeta")),
  ]);
  const [manifest, paper, folia, paperApi, velocityApi, fabricGame, fabricLoader, fabricApi, loom, neoForge, forge, gradle, moddev] = loaded;

  const data: SourceData = {
    manifest: manifest.value,
    paperMcVersions: paper.value,
    foliaMcVersions: folia.value,
    paperApiVersions: paperApi.value,
    velocityApiVersions: velocityApi.value,
    fabricGameVersions: fabricGame.value,
    fabricLoader: fabricLoader.value,
    fabricApiVersions: fabricApi.value,
    loomVersions: loom.value,
    neoForgeVersions: neoForge.value,
    forgePromos: forge.value,
    gradle: gradle.value,
    moddevgradle: moddev.value,
  };
  const warnings = loaded.filter((entry) => entry.stale).map((entry) => staleWarning(SOURCE_URLS[entry.name], entry.ageMs));
  return { data, warnings };
}

export function buildMatrix(data: SourceData): VersionMatrix {
  const released = new Set(data.manifest.releases.map((release) => release.id));
  const newestReleased = (versions: readonly string[]): string | undefined => versions.find((version) => released.has(version));
  const loom = latestStableLoom(data.loomVersions);
  const velocity = resolveVelocityApi(data.velocityApiVersions);

  return {
    minecraft: { latestRelease: data.manifest.latestRelease, latestSnapshot: data.manifest.latestSnapshot },
    newestSupported: {
      paper: newestReleased(data.paperMcVersions),
      folia: newestReleased(data.foliaMcVersions),
      fabric: newestReleased(data.fabricGameVersions),
      neoforge: newestReleased(listNeoForgeMcVersions(data.neoForgeVersions)),
      forge: newestReleased(sortNewestFirst(Object.keys(data.forgePromos))),
    },
    tools: {
      gradle: data.gradle,
      moddevgradle: data.moddevgradle,
      fabricLoader: data.fabricLoader,
      ...(loom ? { loom } : {}),
      ...(velocity ? { velocityApi: velocity.stable } : {}),
    },
  };
}

/** Reads Java from Mojang's per-version metadata, so no table of Java versions is ever kept here. */
export async function fetchJavaRequirement(
  http: HttpClient,
  manifest: MojangManifest,
  mcVersion: string,
): Promise<JavaRequirement> {
  const release = manifest.releases.find((candidate) => candidate.id === mcVersion);
  if (!release) throw unknownVersion(manifest, mcVersion);

  const parse = (body: string): JavaRequirement => parseJavaMajor(parseJsonText(body, `the Mojang metadata for ${mcVersion}`));
  const response = await http.get(release.versionUrl, {
    validate: (body) => {
      parse(body);
    },
  });
  return parse(response.body);
}

/**
 * Reads the Java version Velocity's API was compiled for from its Gradle module metadata. A proxy
 * plugin cannot target an older Java than this, and it has nothing to do with the Minecraft version.
 */
export async function fetchVelocityJava(http: HttpClient, version: string): Promise<number> {
  const url = velocityModuleUrl(version);
  const parse = (body: string): number => {
    const { jvmVersion } = parseGradleModule(parseJsonText(body, url));
    if (jvmVersion === undefined) {
      throw new EmdError("BAD_RESPONSE", `Unexpected response: ${url} does not say which Java version Velocity ${version} needs.`);
    }
    return jvmVersion;
  };
  const response = await http.get(url, {
    validate: (body) => {
      parse(body);
    },
  });
  return parse(response.body);
}

/** A copy of the target that knows the Java version Velocity needs. Unchanged when there is no Velocity release. */
export function withVelocityJava(target: TargetInfo, java: number): TargetInfo {
  return target.velocity ? { ...target, velocity: { ...target.velocity, java } } : target;
}

export function resolveTarget(data: SourceData, mcVersion: string, java: JavaRequirement): TargetInfo {
  if (!data.manifest.releases.some((release) => release.id === mcVersion)) {
    throw unknownVersion(data.manifest, mcVersion);
  }

  const paper = resolvePaperApi(mcVersion, data.paperApiVersions);
  const paperServer = platformSupport(data.paperMcVersions, mcVersion);
  const folia = platformSupport(data.foliaMcVersions, mcVersion);
  const velocity = resolveVelocityApi(data.velocityApiVersions);
  const fabric = resolveFabric(data, mcVersion);
  const neoforge = resolveNeoForge(mcVersion, data.neoForgeVersions);
  const forge = Object.hasOwn(data.forgePromos, mcVersion) ? data.forgePromos[mcVersion] : undefined;

  const warnings = [
    ...floorWarning(mcVersion),
    ...(paper ? paperChannelWarning(paper) : [`Paper has no API for ${mcVersion}.`]),
    ...unavailableMessage("Paper has no server build", paperServer, mcVersion),
    ...unavailableMessage("Folia has no build", folia, mcVersion),
    ...(velocity ? [] : ["Velocity has no stable API release."]),
    ...fabric.warnings,
    ...neoForgeWarnings(data.neoForgeVersions, neoforge, mcVersion),
    ...(forge ? [] : [`Forge has no build for ${mcVersion}.`]),
  ];

  return {
    mcVersion,
    java,
    paper,
    folia,
    velocity,
    fabric: fabric.target,
    neoforge,
    forge,
    tools: { gradle: data.gradle, moddevgradle: data.moddevgradle },
    warnings,
  };
}

async function load<T>(http: HttpClient, name: SourceName, parse: (body: string) => T): Promise<Loaded<T>> {
  const response = await http.get(SOURCE_URLS[name], {
    validate: (body) => {
      parse(body);
    },
  });
  return { name, value: parse(response.body), stale: response.source === "stale-cache", ageMs: response.ageMs };
}

function fromJson<T>(name: SourceName, parser: (json: unknown) => T): (body: string) => T {
  return (body) => parser(parseJsonText(body, SOURCE_URLS[name]));
}

function mavenVersions(name: SourceName): (body: string) => string[] {
  return (body) => nonEmpty(parseMavenVersions(body), name);
}

function parseNonEmptyForgePromos(json: unknown): ForgePromos {
  const promos = parseForgePromos(json);
  if (Object.keys(promos).length === 0) {
    throw new EmdError("BAD_RESPONSE", `Unexpected response: ${SOURCE_URLS.forgePromos} lists no promotions.`);
  }
  return promos;
}

function nonEmpty<T>(items: readonly T[], name: SourceName): T[] {
  if (items.length === 0) {
    throw new EmdError("BAD_RESPONSE", `Unexpected response: ${SOURCE_URLS[name]} lists no versions.`);
  }
  return [...items];
}

function requireStable(versions: readonly string[], name: SourceName): string {
  const version = newestStable(versions);
  if (version === undefined) {
    throw new EmdError("BAD_RESPONSE", `Unexpected response: ${SOURCE_URLS[name]} lists no stable version.`);
  }
  return version;
}

function platformSupport(supported: readonly string[], mcVersion: string): PlatformSupport {
  return { available: supported.includes(mcVersion), newest: supported[0] };
}

function unavailableMessage(label: string, support: PlatformSupport, mcVersion: string): string[] {
  return support.available ? [] : [`${label} for ${mcVersion} (newest: ${support.newest ?? "none"}).`];
}

function floorWarning(mcVersion: string): string[] {
  if (compareDotted(mcVersion, RESOLVER_FLOOR) >= 0) return [];
  return [
    `Minecraft ${mcVersion} is older than ${RESOLVER_FLOOR}. Data below that is incomplete: Paper, Fabric API and NeoForge publish older versions under different names, so a platform shown as missing may still exist.`,
  ];
}

function paperChannelWarning(paper: PaperApiResolution): string[] {
  const prerelease = paper.latestBuildChannel !== "snapshot" && paper.latestStable === undefined;
  return prerelease ? [`Paper only has ${paper.latestBuildChannel} builds for ${paper.mcVersion}.`] : [];
}

function resolveFabric(data: SourceData, mcVersion: string): { target?: FabricTarget; warnings: string[] } {
  if (!data.fabricGameVersions.includes(mcVersion)) {
    return { warnings: [`Fabric does not support ${mcVersion} yet.`] };
  }
  const api = resolveFabricApi(mcVersion, data.fabricApiVersions);
  const loom = latestStableLoom(data.loomVersions);
  return {
    target: { loader: data.fabricLoader, api, loomPluginId: loomPluginId(mcVersion), loom },
    warnings: [
      ...(api ? [] : [`Fabric API has no build for ${mcVersion}.`]),
      ...(loom ? [] : ["Fabric Loom has no stable release."]),
    ],
  };
}

function neoForgeWarnings(versions: readonly string[], build: NeoForgeBuild | undefined, mcVersion: string): string[] {
  if (!build) return [`NeoForge has no build for ${mcVersion}.`];
  const hasStable = versions.some((version) => neoForgeMcVersion(version) === mcVersion && neoForgeChannel(version) === "stable");
  return hasStable ? [] : [`NeoForge only has ${build.channel} builds for ${mcVersion}.`];
}

function staleWarning(url: string, ageMs: number | undefined): string {
  const age = ageMs === undefined ? "" : ` (${describeAge(ageMs)} old)`;
  return `Using out-of-date cached data for ${url}${age}.`;
}

function describeAge(ageMs: number): string {
  const days = Math.floor(ageMs / DAY_MS);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.floor(ageMs / HOUR_MS));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function unknownVersion(manifest: MojangManifest, mcVersion: string): EmdError {
  return new EmdError(
    "UNKNOWN_MC_VERSION",
    `Minecraft ${mcVersion} is not a released version. The newest release is ${manifest.latestRelease}.`,
  );
}
