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
