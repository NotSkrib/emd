import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildMatrix,
  fetchJavaRequirement,
  fetchSourceData,
  fetchVelocityJava,
  resolveTarget,
  withVelocityJava,
  type SourceData,
} from "../../src/versions/resolver.js";
import { SOURCE_URLS } from "../../src/versions/sources.js";
import { errorCodeOf, errorCodeOfAsync, fixtureHttp } from "../helpers/fixtures.js";

const JAVA_25 = { major: 25, source: "mojang" } as const;

const release = (id: string, releaseTime: string) => ({ id, releaseTime, versionUrl: `https://example.test/${id}.json` });

const SOURCE: SourceData = {
  manifest: {
    latestRelease: "26.3",
    latestSnapshot: "26.4-snapshot-3",
    releases: [
      release("26.3", "2026-09-15T11:23:02+00:00"),
      release("26.2", "2026-07-01T10:00:00+00:00"),
      release("1.21.11", "2025-12-09T12:23:30+00:00"),
    ],
  },
  paperMcVersions: ["26.3", "26.2", "1.21.11"],
  foliaMcVersions: ["26.2", "1.21.11"],
  paperApiVersions: ["26.3.build.10-beta", "26.2.build.5-stable", "1.21.11-R0.1-SNAPSHOT"],
  velocityApiVersions: ["4.2.0", "4.2.1-SNAPSHOT"],
  fabricGameVersions: ["26.3", "26.2", "1.21.11"],
  fabricLoader: "0.19.5",
  fabricApiVersions: ["0.162.0+26.3", "0.150.0+26.2", "0.141.3+1.21.11"],
  loomVersions: ["1.18.2", "1.18.3", "1.19-SNAPSHOT"],
  neoForgeVersions: ["26.3.0.58-beta", "26.2.0.88", "21.11.45"],
  forgePromos: { "26.3": { latest: "66.0.9" }, "26.2": { latest: "65.1.3", recommended: "65.1.0" } },
  gradle: "9.8.1",
  moddevgradle: "2.0.148",
  packFormats: new Map([
    ["26.3", { data: { major: 121, minor: 0 }, resource: { major: 97, minor: 1 } }],
    ["26.2", { data: { major: 107, minor: 1 }, resource: { major: 88, minor: 0 } }],
    ["1.21.11", { data: { major: 94, minor: 1 }, resource: { major: 75, minor: 0 } }],
  ]),
};

describe("resolveTarget", () => {
  it("resolves every platform for a fully supported release", () => {
    const info = resolveTarget(SOURCE, "26.2", JAVA_25);

    expect(info.java).toEqual(JAVA_25);
    expect(info.paper?.dependencyVersion).toBe("26.2.build.+");
    expect(info.folia).toEqual({ available: true, newest: "26.2" });
    expect(info.velocity).toEqual({ stable: "4.2.0", snapshot: "4.2.1-SNAPSHOT" });
    expect(info.fabric).toEqual({
      loader: "0.19.5",
      api: "0.150.0+26.2",
      loomPluginId: "net.fabricmc.fabric-loom",
      loom: "1.18.3",
    });
    expect(info.neoforge).toEqual({ version: "26.2.0.88", channel: "stable" });
    expect(info.forge).toEqual({ latest: "65.1.3", recommended: "65.1.0" });
    expect(info.tools).toEqual({ gradle: "9.8.1", moddevgradle: "2.0.148" });
    expect(info.warnings).toEqual([]);
  });

  it("warns when Folia lags behind Paper", () => {
    const info = resolveTarget(SOURCE, "26.3", JAVA_25);

    expect(info.folia).toEqual({ available: false, newest: "26.2" });
    expect(info.warnings).toContain("Folia has no build for 26.3 (newest: 26.2).");
  });

  it("warns when NeoForge only has pre-release builds", () => {
    const info = resolveTarget(SOURCE, "26.3", JAVA_25);

    expect(info.neoforge?.channel).toBe("beta");
    expect(info.warnings).toContain("NeoForge only has beta builds for 26.3.");
  });

  it("uses the remapping Loom plugin and the pinned Paper API for older releases", () => {
    const info = resolveTarget(SOURCE, "1.21.11", { major: 21, source: "mojang" });

    expect(info.fabric?.loomPluginId).toBe("net.fabricmc.fabric-loom-remap");
    expect(info.paper?.dependencyVersion).toBe("1.21.11-R0.1-SNAPSHOT");
    expect(info.neoforge?.version).toBe("21.11.45");
    expect(info.warnings).toContain("Forge has no build for 1.21.11.");
  });

  it("omits Fabric and warns when the loader does not support the release", () => {
    const source: SourceData = { ...SOURCE, fabricGameVersions: ["26.2"] };
    const info = resolveTarget(source, "26.3", JAVA_25);

    expect(info.fabric).toBeUndefined();
    expect(info.warnings).toContain("Fabric does not support 26.3 yet.");
  });

  it("rejects a Minecraft version Mojang has not released", () => {
    expect(errorCodeOf(() => resolveTarget(SOURCE, "27.0", JAVA_25))).toBe("UNKNOWN_MC_VERSION");
  });
});

describe("buildMatrix", () => {
  it("summarises the newest release each platform supports", () => {
    const matrix = buildMatrix(SOURCE);

    expect(matrix.minecraft).toEqual({ latestRelease: "26.3", latestSnapshot: "26.4-snapshot-3" });
    expect(matrix.newestSupported).toEqual({
      paper: "26.3",
      folia: "26.2",
      fabric: "26.3",
      neoforge: "26.3",
      forge: "26.3",
    });
    expect(matrix.tools).toEqual({
      gradle: "9.8.1",
      moddevgradle: "2.0.148",
      loom: "1.18.3",
      fabricLoader: "0.19.5",
      velocityApi: "4.2.0",
    });
  });
});

describe("fetchSourceData", () => {
  it("assembles every source from the recorded responses", async () => {
    const { data, warnings } = await fetchSourceData(fixtureHttp());

    expect(data.manifest.latestRelease.length).toBeGreaterThan(0);
    expect(data.paperMcVersions.length).toBeGreaterThan(5);
    expect(data.fabricGameVersions.length).toBeGreaterThan(0);
    expect(data.neoForgeVersions.length).toBeGreaterThan(10);
    expect(data.gradle).toMatch(/^\d+\.\d+/);
    expect(warnings).toEqual([]);
  });

  it("warns about sources answered from a stale cache", async () => {
    const stale = { body: JSON.stringify({ versions: { "1.21": ["1.21.11"] } }), source: "stale-cache" } as const;
    const { data, warnings } = await fetchSourceData(fixtureHttp({ [SOURCE_URLS.fillFolia]: stale }));

    expect(data.foliaMcVersions).toEqual(["1.21.11"]);
    expect(warnings).toEqual([`Using out-of-date cached data for ${SOURCE_URLS.fillFolia}.`]);
  });

  it("builds a matrix from the recorded data", async () => {
    const { data } = await fetchSourceData(fixtureHttp());
    const matrix = buildMatrix(data);

    expect(matrix.newestSupported.paper).toBeDefined();
    expect(matrix.tools.moddevgradle).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("fetchJavaRequirement", () => {
  it("reads Java from the per-version metadata", async () => {
    const { data } = await fetchSourceData(fixtureHttp());

    expect(await fetchJavaRequirement(fixtureHttp(), data.manifest, "1.21.11")).toEqual({ major: 21, source: "mojang" });
  });

  it("falls back to Java 8 when the metadata has no Java field", async () => {
    const { data } = await fetchSourceData(fixtureHttp());
    const url = data.manifest.releases.find((candidate) => candidate.id === "1.12.2")?.versionUrl ?? "";
    const http = fixtureHttp({ [url]: { body: JSON.stringify({ id: "1.12.2" }), source: "network" } });

    expect(await fetchJavaRequirement(http, data.manifest, "1.12.2")).toEqual({ major: 8, source: "fallback" });
  });

  it("rejects an unknown Minecraft version", async () => {
    const { data } = await fetchSourceData(fixtureHttp());

    expect(await errorCodeOfAsync(() => fetchJavaRequirement(fixtureHttp(), data.manifest, "27.0"))).toBe("UNKNOWN_MC_VERSION");
  });
});

describe("pack formats", () => {
  it("are carried into the target for the chosen release", () => {
    const target = resolveTarget(SOURCE, "26.3", JAVA_25);

    expect(target.packFormats).toEqual({ data: { major: 121, minor: 0 }, resource: { major: 97, minor: 1 } });
    expect(target.warnings.filter((warning) => /pack format/i.test(warning))).toEqual([]);
  });

  it("are absent, with one warning per pack kind, for a release the source does not list yet", () => {
    const target = resolveTarget({ ...SOURCE, packFormats: new Map() }, "26.2", JAVA_25);

    expect(target.packFormats).toBeUndefined();
    expect(target.warnings).toContain("Data pack format is not published for 26.2 yet.");
    expect(target.warnings).toContain("Resource pack format is not published for 26.2 yet.");
  });

  it("are read from the recorded upstream data", async () => {
    const { data } = await fetchSourceData(fixtureHttp());

    expect(data.packFormats.get(data.manifest.latestRelease)).toBeDefined();
  });

  it("are rejected when the source lists no release at all", async () => {
    const http = fixtureHttp({ [SOURCE_URLS.packFormats]: { body: "[]", source: "network" } });

    expect(await errorCodeOfAsync(() => fetchSourceData(http))).toBe("BAD_RESPONSE");
  });

  it("are rejected when the source is not a list", async () => {
    const http = fixtureHttp({ [SOURCE_URLS.packFormats]: { body: "{}", source: "network" } });

    expect(await errorCodeOfAsync(() => fetchSourceData(http))).toBe("BAD_RESPONSE");
  });
});

describe("fetchVelocityJava", () => {
  const MODULE_URL = "https://repo.papermc.io/repository/maven-public/com/velocitypowered/velocity-api/4.2.0/velocity-api-4.2.0.module";

  it("reads the Java version Velocity's API was compiled for", async () => {
    expect(await fetchVelocityJava(fixtureHttp(), "4.2.0")).toBe(25);
  });

  it("asks for the module of exactly the version it was given", async () => {
    const asked: string[] = [];
    const recording = {
      async get(url: string) {
        asked.push(url);
        return fixtureHttp().get(url);
      },
    };

    await fetchVelocityJava(recording, "4.2.0");

    expect(asked).toEqual([MODULE_URL]);
  });

  it.each(["../../x", "4.2.0/../../y", "4.2 0", "", "4.2.0?x=1"])("refuses the version %j", async (version) => {
    expect(await errorCodeOfAsync(() => fetchVelocityJava(fixtureHttp(), version))).toBe("BAD_URL");
  });

  it("reports a module that does not say which Java it needs", async () => {
    const http = fixtureHttp({ [MODULE_URL]: { body: JSON.stringify({ variants: [] }), source: "network" } });

    expect(await errorCodeOfAsync(() => fetchVelocityJava(http, "4.2.0"))).toBe("BAD_RESPONSE");
  });

  it("reports a module that is not JSON", async () => {
    const http = fixtureHttp({ [MODULE_URL]: { body: "<html>proxy error</html>", source: "network" } });

    expect(await errorCodeOfAsync(() => fetchVelocityJava(http, "4.2.0"))).toBe("BAD_RESPONSE");
  });
});

describe("withVelocityJava", () => {
  const target = resolveTarget(SOURCE, "26.3", JAVA_25);

  it("returns a copy that knows the Java version, leaving the original untouched", () => {
    const updated = withVelocityJava(target, 25);

    expect(updated.velocity).toEqual({ stable: "4.2.0", snapshot: "4.2.1-SNAPSHOT", java: 25 });
    expect(target.velocity).toEqual({ stable: "4.2.0", snapshot: "4.2.1-SNAPSHOT" });
  });

  it("returns the target as it was when there is no Velocity release", () => {
    const without = resolveTarget({ ...SOURCE, velocityApiVersions: ["4.2.1-SNAPSHOT"] }, "26.3", JAVA_25);

    expect(withVelocityJava(without, 25)).toBe(without);
  });
});

describe("resolveTarget warnings", () => {
  const withReleases = (...ids: string[]): SourceData => ({
    ...SOURCE,
    manifest: {
      ...SOURCE.manifest,
      releases: [...SOURCE.manifest.releases, ...ids.map((id) => release(id, "2021-01-15T00:00:00+00:00"))],
    },
  });

  it("flags Minecraft versions older than the resolver is verified for", () => {
    const info = resolveTarget(withReleases("1.16.5"), "1.16.5", { major: 8, source: "mojang" });

    expect(info.warnings[0]).toContain("older than 1.20.5");
  });

  it("does not flag versions it is verified for", () => {
    const info = resolveTarget(SOURCE, "1.21.11", { major: 21, source: "mojang" });

    expect(info.warnings.some((warning) => warning.includes("older than"))).toBe(false);
  });

  it("warns when Paper only has pre-release builds", () => {
    expect(resolveTarget(SOURCE, "26.3", JAVA_25).warnings).toContain("Paper only has beta builds for 26.3.");
  });

  it("does not warn about channels for a stable Paper release", () => {
    const warnings = resolveTarget(SOURCE, "26.2", JAVA_25).warnings;

    expect(warnings.some((warning) => warning.startsWith("Paper only"))).toBe(false);
  });

  it("does not treat inherited object properties as Forge builds", () => {
    expect(resolveTarget(withReleases("constructor"), "constructor", JAVA_25).forge).toBeUndefined();
  });

  it("warns when Velocity has no stable release", () => {
    const source: SourceData = { ...SOURCE, velocityApiVersions: ["4.2.1-SNAPSHOT"] };

    expect(resolveTarget(source, "26.2", JAVA_25).warnings).toContain("Velocity has no stable API release.");
  });

  it("warns when Fabric Loom has no stable release", () => {
    const source: SourceData = { ...SOURCE, loomVersions: ["1.19-SNAPSHOT"] };
    const info = resolveTarget(source, "26.2", JAVA_25);

    expect(info.fabric?.loom).toBeUndefined();
    expect(info.warnings).toContain("Fabric Loom has no stable release.");
  });
});

describe("buildMatrix with unreleased platform versions", () => {
  it("ignores platform builds for Minecraft versions Mojang has not released", () => {
    const source: SourceData = {
      ...SOURCE,
      neoForgeVersions: [...SOURCE.neoForgeVersions, "26.9.0.1"],
      paperMcVersions: ["26.9", ...SOURCE.paperMcVersions],
    };
    const matrix = buildMatrix(source);

    expect(matrix.newestSupported.neoforge).toBe("26.3");
    expect(matrix.newestSupported.paper).toBe("26.3");
  });
});

describe("fetchSourceData validation", () => {
  it("rejects a Maven source that parses to nothing", async () => {
    const html = { body: "<html>maintenance</html>", source: "network" } as const;

    expect(await errorCodeOfAsync(() => fetchSourceData(fixtureHttp({ [SOURCE_URLS.paperApiMeta]: html })))).toBe("BAD_RESPONSE");
  });

  it("says how old a stale source is", async () => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const stale = { body: JSON.stringify({ versions: { "1.21": ["1.21.11"] } }), source: "stale-cache", ageMs: threeDaysMs } as const;
    const { warnings } = await fetchSourceData(fixtureHttp({ [SOURCE_URLS.fillFolia]: stale }));

    expect(warnings).toEqual([`Using out-of-date cached data for ${SOURCE_URLS.fillFolia} (3 days old).`]);
  });

  it("rejects a ModDevGradle list with no stable version", async () => {
    const body = "<metadata><versioning><versions><version>2.0.0-beta.1</version></versions></versioning></metadata>";
    const overrides = { [SOURCE_URLS.moddevgradleMeta]: { body, source: "network" } } as const;

    expect(await errorCodeOfAsync(() => fetchSourceData(fixtureHttp(overrides)))).toBe("BAD_RESPONSE");
  });
});

describe("the fixture recorder", () => {
  it("covers every version source URL", () => {
    const recorder = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "record-fixtures.mjs"),
      "utf8",
    );

    for (const url of Object.values(SOURCE_URLS)) {
      expect(recorder).toContain(url);
    }
  });
});
