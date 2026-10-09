import { describe, expect, it } from "vitest";
import { runVersions } from "../../src/commands/versions.js";
import { parseMojangManifest } from "../../src/versions/mojang.js";
import { SOURCE_URLS } from "../../src/versions/sources.js";
import { errorCodeOfAsync, fixtureHttp, fixtureJson } from "../helpers/fixtures.js";

const LATEST = parseMojangManifest(fixtureJson("mojang-manifest.json")).latestRelease;

interface MatrixJson {
  minecraft: { latestRelease: string };
  tools: { gradle: string };
  warnings: string[];
}

interface TargetJson {
  mcVersion: string;
  java: { major: number };
  paper?: { dependencyVersion: string };
}

describe("runVersions", () => {
  it("prints the platform overview as text", async () => {
    const output = await runVersions({ json: false }, fixtureHttp());

    expect(output).toContain(`Minecraft ${LATEST}`);
    expect(output).toContain("Paper");
    expect(output).toContain("Gradle");
  });

  it("prints the platform overview as JSON", async () => {
    const parsed = JSON.parse(await runVersions({ json: true }, fixtureHttp())) as MatrixJson;

    expect(parsed.minecraft.latestRelease).toBe(LATEST);
    expect(parsed.tools.gradle).toMatch(/^\d/);
    expect(parsed.warnings).toEqual([]);
  });

  it("resolves one Minecraft version as JSON", async () => {
    const parsed = JSON.parse(await runVersions({ mc: LATEST, json: true }, fixtureHttp())) as TargetJson;

    expect(parsed.mcVersion).toBe(LATEST);
    expect(parsed.java.major).toBeGreaterThanOrEqual(21);
    expect(parsed.paper?.dependencyVersion).toBeDefined();
  });

  it("describes one Minecraft version as text", async () => {
    const output = await runVersions({ mc: LATEST, json: false }, fixtureHttp());

    expect(output).toContain(`Minecraft ${LATEST}`);
    expect(output).toContain("Java");
    expect(output).toContain("Paper");
    expect(output).toContain("NeoForge");
  });

  it("shows the pack formats of one Minecraft version, with their minor parts", async () => {
    const output = await runVersions({ mc: LATEST, json: false }, fixtureHttp());

    expect(output).toMatch(/Packs\s+data \d+\.\d+, resource \d+\.\d+/);
  });

  it("includes the pack formats in the JSON for one Minecraft version", async () => {
    const parsed = JSON.parse(await runVersions({ mc: LATEST, json: true }, fixtureHttp())) as {
      packFormats?: { data: { major: number; minor: number }; resource: { major: number; minor: number } };
    };

    expect(parsed.packFormats?.data.major).toBeGreaterThan(0);
    expect(parsed.packFormats?.resource.major).toBeGreaterThan(0);
  });

  it("says when Java was assumed", async () => {
    const manifest = parseMojangManifest(fixtureJson("mojang-manifest.json"));
    const url = manifest.releases.find((release) => release.id === "1.12.2")?.versionUrl ?? "";
    const http = fixtureHttp({ [url]: { body: JSON.stringify({ id: "1.12.2" }), source: "network" } });

    expect(await runVersions({ mc: "1.12.2", json: false }, http)).toContain("Java 8, assumed");
  });

  it("rejects an unknown Minecraft version", async () => {
    expect(await errorCodeOfAsync(() => runVersions({ mc: "27.0", json: false }, fixtureHttp()))).toBe("UNKNOWN_MC_VERSION");
  });

  it("carries cache warnings into the output", async () => {
    const stale = { body: JSON.stringify({ versions: { "1.21": ["1.21.11"] } }), source: "stale-cache" } as const;
    const output = await runVersions({ json: false }, fixtureHttp({ [SOURCE_URLS.fillFolia]: stale }));

    expect(output).toContain("Warnings:");
    expect(output).toContain("out-of-date cached data");
  });
});
