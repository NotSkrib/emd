import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/versions/http.js";
import { neoForgeChannel, neoForgeMcVersion } from "../../src/versions/neoforge.js";
import { fetchJavaRequirement, fetchSourceData, resolveTarget } from "../../src/versions/resolver.js";

// Hits the real upstream APIs. Run with `npm run test:live`. If an upstream changes its format,
// this fails before any generated project does.
const http = createHttpClient({ cacheDir: null });
const NEWEST_PAPER_RELEASES_THAT_MUST_RESOLVE = 5;
const PAPER_DEPENDENCY_SHAPE = /^(26\.\d+(\.\d+)?\.build\.\+|\d+\.\d+(\.\d+)?-R0\.1-SNAPSHOT)$/;

describe("live version sources", () => {
  it("parses every upstream without falling back to a stale cache", async () => {
    const { data, warnings } = await fetchSourceData(http);

    expect(warnings).toEqual([]);
    expect(data.manifest.releases.length).toBeGreaterThan(50);
    expect(data.paperMcVersions.length).toBeGreaterThan(20);
    expect(data.fabricGameVersions.length).toBeGreaterThan(20);
    expect(data.neoForgeVersions.length).toBeGreaterThan(100);
  });

  it("resolves the newest Minecraft release end to end", async () => {
    const { data } = await fetchSourceData(http);
    const latest = data.manifest.latestRelease;
    const java = await fetchJavaRequirement(http, data.manifest, latest);
    const target = resolveTarget(data, latest, java);

    expect(java.source).toBe("mojang");
    expect(java.major).toBeGreaterThanOrEqual(21);
    expect(target.paper?.dependencyVersion).toBeDefined();
    expect(target.fabric?.api).toBeDefined();
    expect(target.fabric?.loom).toBeDefined();
    expect(target.neoforge).toBeDefined();
    expect(target.forge).toBeDefined();
  });

  it("returns a well-formed Paper dependency for the releases Paper publishes an API for", async () => {
    const { data } = await fetchSourceData(http);
    const java = { major: 21, source: "mojang" } as const;

    for (const mcVersion of data.paperMcVersions) {
      const target = resolveTarget(data, mcVersion, java);
      if (target.paper) expect(target.paper.dependencyVersion, mcVersion).toMatch(PAPER_DEPENDENCY_SHAPE);
    }

    for (const mcVersion of data.paperMcVersions.slice(0, NEWEST_PAPER_RELEASES_THAT_MUST_RESOLVE)) {
      expect(resolveTarget(data, mcVersion, java).paper, mcVersion).toBeDefined();
    }
  });

  it("maps every stable NeoForge build to a Minecraft release Mojang knows", async () => {
    const { data } = await fetchSourceData(http);
    const known = new Set(data.manifest.releases.map((release) => release.id));

    const unmapped = data.neoForgeVersions
      .filter((version) => neoForgeChannel(version) === "stable")
      .filter((version) => {
        const mcVersion = neoForgeMcVersion(version);
        return mcVersion === undefined || !known.has(mcVersion);
      });

    expect(unmapped).toEqual([]);
  });

  it("only lists Fabric game versions that Mojang released", async () => {
    const { data } = await fetchSourceData(http);
    const known = new Set(data.manifest.releases.map((release) => release.id));

    expect(data.fabricGameVersions.filter((version) => !known.has(version))).toEqual([]);
  });
});
