import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateAnswers } from "../../src/presets/answers.js";
import { buildContext, resolvedValues } from "../../src/presets/context.js";
import { lintManifest } from "../../src/presets/lint.js";
import { loadPresets, type LoadedPreset } from "../../src/presets/load.js";
import { planFiles } from "../../src/presets/plan.js";
import type { PlannedFile } from "../../src/presets/types.js";
import { fetchJavaRequirement, fetchSourceData, resolveTarget } from "../../src/versions/resolver.js";
import { fixtureHttp } from "../helpers/fixtures.js";

const PRESETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "presets");
const presets = await loadPresets(PRESETS_DIR);

const http = fixtureHttp();
const { data } = await fetchSourceData(http);
const latest = data.manifest.latestRelease;
const target = resolveTarget(data, latest, await fetchJavaRequirement(http, data.manifest, latest));

/** Renders a preset using each input's default, or its example when it has no default. */
function render(preset: LoadedPreset): PlannedFile[] {
  const samples = Object.fromEntries(
    preset.manifest.inputs.flatMap((spec) => {
      const value = spec.default ?? spec.example;
      return value === undefined ? [] : [[spec.key, value] as const];
    }),
  );
  const answers = validateAnswers(preset.manifest, samples);
  return planFiles(preset.manifest, preset.templates, buildContext(preset.manifest, answers, resolvedValues(target)));
}

it("ships at least one preset", () => {
  expect(presets.length).toBeGreaterThan(0);
});

for (const preset of presets) {
  describe(`shipped preset ${preset.manifest.id}`, () => {
    it("passes the licence and provenance lint", () => {
      expect(lintManifest(preset.manifest)).toEqual([]);
    });

    it("gives every required input an example or a default", () => {
      const missing = preset.manifest.inputs
        .filter((spec) => spec.optional !== true && spec.default === undefined && spec.example === undefined)
        .map((spec) => spec.key);

      expect(missing).toEqual([]);
    });

    it("renders valid JSON for every .json file", () => {
      for (const file of render(preset).filter((candidate) => candidate.path.endsWith(".json"))) {
        expect(() => JSON.parse(file.content), file.path).not.toThrow();
      }
    });

    it("renders for the latest release with no unreplaced tokens", () => {
      const files = render(preset);

      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        expect(file.content.length, file.path).toBeGreaterThan(0);
        expect(file.content, file.path).not.toMatch(/\{\{\s*[a-z]+\./);
      }
    });
  });
}

describe("fabric-mod output", () => {
  const preset = presets.find((candidate) => candidate.manifest.id === "fabric-mod");
  const files = preset ? render(preset) : [];
  const content = (file: string): string => files.find((candidate) => candidate.path === file)?.content ?? "";

  it("uses the resolver's Fabric, Loom, Java and Minecraft versions", () => {
    expect(preset).toBeDefined();
    expect(content("gradle.properties")).toContain(`minecraft_version=${latest}`);
    expect(content("gradle.properties")).toContain(`loader_version=${target.fabric?.loader}`);
    expect(content("gradle.properties")).toContain(`loom_version=${target.fabric?.loom}`);
    expect(content("gradle.properties")).toContain(`fabric_api_version=${target.fabric?.api}`);
    expect(content("build.gradle")).toContain(`id '${target.fabric?.loomPluginId}'`);
    expect(content("build.gradle")).toContain(`it.options.release = ${target.java.major}`);
  });

  it("writes a descriptor that parses and points at the generated classes", () => {
    const descriptor = JSON.parse(content("src/main/resources/fabric.mod.json") || "{}") as {
      id: string;
      version: string;
      entrypoints: { main: string[]; client: string[] };
      depends: Record<string, string>;
    };

    expect(descriptor.id).toBe("my_mod");
    expect(descriptor.version).toBe("@version@");
    expect(descriptor.entrypoints.main).toEqual(["dev.example.mymod.MyMod"]);
    expect(descriptor.entrypoints.client).toEqual(["dev.example.mymod.client.MyModClient"]);
    expect(descriptor.depends.minecraft).toBe(`~${latest}`);
  });

  it("puts the entrypoints where Gradle's split source sets expect them", () => {
    const paths = files.map((file) => file.path);

    expect(paths).toContain("src/main/java/dev/example/mymod/MyMod.java");
    expect(paths).toContain("src/client/java/dev/example/mymod/client/MyModClient.java");
  });
});

describe("paper-plugin-gradle output", () => {
  const preset = presets.find((candidate) => candidate.manifest.id === "paper-plugin-gradle");

  it("uses the resolver's Paper dependency, Java version and Minecraft version", () => {
    expect(preset).toBeDefined();
    const files = preset ? render(preset) : [];
    const content = (file: string): string => files.find((candidate) => candidate.path === file)?.content ?? "";

    expect(content("build.gradle.kts")).toContain(`paper-api:${target.paper?.dependencyVersion}`);
    expect(content("build.gradle.kts")).toContain(`JavaLanguageVersion.of(${target.java.major})`);
    expect(content("build.gradle.kts")).toContain(`minecraftVersion("${latest}")`);
    expect(content("src/main/resources/plugin.yml")).toContain(`api-version: "${latest}"`);
    expect(content("src/main/resources/plugin.yml")).toContain("main: dev.example.myplugin.MyPlugin");
    expect(files.map((file) => file.path)).toContain("src/main/java/dev/example/myplugin/MyPlugin.java");
  });
});
