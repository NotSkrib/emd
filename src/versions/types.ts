export type Channel = "stable" | "beta" | "alpha";

export interface JavaRequirement {
  major: number;
  /** "mojang" when read from Mojang's metadata, "fallback" for versions that predate the field. */
  source: "mojang" | "fallback";
}

export interface McRelease {
  id: string;
  releaseTime: string;
  versionUrl: string;
}

export interface MojangManifest {
  latestRelease: string;
  latestSnapshot: string;
  /** Releases only, newest first. */
  releases: McRelease[];
}

export interface PaperApiResolution {
  mcVersion: string;
  /** What to put in the build file: dynamic ("26.3.build.+") from 26.1, pinned ("1.21.11-R0.1-SNAPSHOT") before. */
  dependencyVersion: string;
  /** Newest concrete Maven version found. */
  latestBuild: string;
  latestBuildChannel: Channel | "snapshot";
  latestStable?: string;
}

export interface VelocityApi {
  stable: string;
  snapshot?: string;
}

export interface ForgeBuilds {
  latest?: string;
  recommended?: string;
}

export type ForgePromos = Record<string, ForgeBuilds>;

export interface NeoForgeBuild {
  version: string;
  channel: Channel;
}

export type LoomPluginId = "net.fabricmc.fabric-loom" | "net.fabricmc.fabric-loom-remap";

export interface FabricTarget {
  loader: string;
  api?: string;
  loomPluginId: LoomPluginId;
  loom?: string;
}
