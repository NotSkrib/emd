import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateAnswers } from "../../src/presets/answers.js";
import { buildContext, resolvedValues } from "../../src/presets/context.js";
import { lintManifest } from "../../src/presets/lint.js";
import { loadPresets, type LoadedPreset } from "../../src/presets/load.js";
import { planFiles } from "../../src/presets/plan.js";
import { sampleAnswers } from "../../src/presets/samples.js";
import type { PlannedFile } from "../../src/presets/types.js";
import { fetchJavaRequirement, fetchSourceData, fetchVelocityJava, resolveTarget, withVelocityJava } from "../../src/versions/resolver.js";
import { fixtureHttp } from "../helpers/fixtures.js";

const PRESETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "presets");
const presets = await loadPresets(PRESETS_DIR);

const http = fixtureHttp();
const { data } = await fetchSourceData(http);
const latest = data.manifest.latestRelease;
const resolved = resolveTarget(data, latest, await fetchJavaRequirement(http, data.manifest, latest));
if (!resolved.velocity) throw new Error("The recorded fixtures have no stable Velocity release.");
/** The same lookups `emd new` does, so a preset can use every `resolved.*` value. */
const target = withVelocityJava(resolved, await fetchVelocityJava(http, resolved.velocity.stable));

/** Renders a preset using each input's default, or its example when it has no default. */
function render(preset: LoadedPreset): PlannedFile[] {
  const answers = validateAnswers(preset.manifest, sampleAnswers(preset.manifest));
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

/** Lessons from building the generated projects with real Gradle. */
describe("generated Gradle builds", () => {
  const gradleBuilds = presets.flatMap((preset) => {
    const files = render(preset);
    const build = files.find((file) => /^build\.gradle(\.kts)?$/.test(file.path));
    return build ? [{ id: preset.manifest.id, build: build.content, files }] : [];
  });

  it("covers every shipped preset", () => {
    expect(gradleBuilds.map((entry) => entry.id).sort()).toEqual(presets.map((preset) => preset.manifest.id).sort());
  });

  it.each(gradleBuilds)("$id never reads `project` inside a filter closure (breaks the configuration cache)", ({ build }) => {
    const filterLines = build.split("\n").filter((line) => line.includes("filter {"));

    expect(filterLines.length).toBeGreaterThan(0);
    for (const line of filterLines) expect(line).not.toContain("project.");
  });

  it.each(gradleBuilds)("$id tells the user which Gradle to use", ({ files }) => {
    const advice = `gradle wrapper --gradle-version ${target.tools.gradle}`;

    expect(files.find((file) => file.path === "README.md")?.content).toContain(advice);
    expect(files.find((file) => file.path === "AGENTS.md")?.content).toContain(`Gradle ${target.tools.gradle} or newer`);
  });
});

describe("velocity-plugin output", () => {
  const preset = presets.find((candidate) => candidate.manifest.id === "velocity-plugin");
  const files = preset ? render(preset) : [];
  const content = (file: string): string => files.find((candidate) => candidate.path === file)?.content ?? "";

  it("uses the Velocity API and the Java version the API was compiled for", () => {
    expect(preset).toBeDefined();
    expect(content("build.gradle.kts")).toContain(`velocity-api:${target.velocity?.stable}`);
    expect(content("build.gradle.kts")).toContain(`JavaLanguageVersion.of(${target.velocity?.java})`);
    expect(content("build.gradle.kts")).toContain(`options.release.set(${target.velocity?.java})`);
    expect(content("build.gradle.kts")).toContain(`velocityVersion("${target.velocity?.stable}")`);
  });

  it("does not depend on a Minecraft version", () => {
    expect(preset?.manifest.minecraft).toEqual({});
    expect(files.map((file) => file.content).join("\n")).not.toContain(latest);
  });

  it("writes a descriptor that parses and points at the generated class", () => {
    const descriptor = JSON.parse(content("src/main/resources/velocity-plugin.json") || "{}") as Record<string, unknown>;

    expect(descriptor).toEqual({
      id: "my_proxy_plugin",
      name: "MyProxyPlugin",
      version: "@version@",
      description: "A Velocity plugin.",
      authors: ["YourName"],
      main: "dev.example.myproxyplugin.MyProxyPlugin",
    });
    expect(files.map((file) => file.path)).toContain("src/main/java/dev/example/myproxyplugin/MyProxyPlugin.java");
  });

  it("gives the main class the constructor Velocity builds it with", () => {
    const source = content("src/main/java/dev/example/myproxyplugin/MyProxyPlugin.java");

    expect(source).toContain("@Inject");
    expect(source).toContain("@Subscribe");
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
