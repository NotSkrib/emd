import { describe, expect, it } from "vitest";
import { buildContext, deriveValues, resolvedValues } from "../../src/presets/context.js";
import type { PresetManifest } from "../../src/presets/types.js";
import type { TargetInfo } from "../../src/versions/resolver.js";
import { errorCodeOf } from "../helpers/fixtures.js";

const TARGET: TargetInfo = {
  mcVersion: "26.3",
  java: { major: 25, source: "mojang" },
  paper: { mcVersion: "26.3", dependencyVersion: "26.3.build.+", latestBuild: "26.3.build.10-beta", latestBuildChannel: "beta" },
  folia: { available: false, newest: "26.2" },
  fabric: { loader: "0.19.5", api: "0.162.0+26.3", loomPluginId: "net.fabricmc.fabric-loom", loom: "1.18.3" },
  neoforge: { version: "26.3.0.58-beta", channel: "beta" },
  forge: { latest: "66.0.9" },
  tools: { gradle: "9.8.1", moddevgradle: "2.0.148" },
  warnings: [],
};

const MANIFEST: PresetManifest = {
  schema: 1,
  id: "context-fixture",
  title: "Context fixture",
  kind: "archetype",
  family: "plugin",
  platforms: ["paper"],
  minecraft: {},
  inputs: [
    { key: "name", type: "identifier", label: "Name" },
    { key: "description", type: "text", label: "Description" },
    { key: "website", type: "url", label: "Website" },
    { key: "folia", type: "boolean", label: "Folia" },
  ],
  files: [],
  provenance: [],
};

describe("deriveValues", () => {
  it("turns a package into a directory path", () => {
    expect(deriveValues({ package: "dev.notskrib.example" })).toEqual({ packagePath: "dev/notskrib/example" });
  });

  it("derives nothing without a package", () => {
    expect(deriveValues({ name: "MyPlugin" })).toEqual({});
  });

  it("ignores a package that is not text", () => {
    expect(deriveValues({ package: true })).toEqual({});
  });
});

describe("resolvedValues", () => {
  it("flattens the resolver's answer to the names templates use", () => {
    expect(resolvedValues(TARGET)).toEqual({
      minecraft: "26.3",
      java: "25",
      gradle: "9.8.1",
      moddevgradle: "2.0.148",
      paperApi: "26.3.build.+",
      fabricLoader: "0.19.5",
      fabricApi: "0.162.0+26.3",
      loom: "1.18.3",
      loomPluginId: "net.fabricmc.fabric-loom",
      neoforge: "26.3.0.58-beta",
      forge: "66.0.9",
    });
  });

  it("leaves out platforms the resolver has no build for", () => {
    const sparse: TargetInfo = { ...TARGET, paper: undefined, fabric: undefined, neoforge: undefined, forge: undefined };

    expect(resolvedValues(sparse)).toEqual({ minecraft: "26.3", java: "25", gradle: "9.8.1", moddevgradle: "2.0.148" });
  });

  it("prefers the recommended Forge build over the latest", () => {
    const target: TargetInfo = { ...TARGET, forge: { latest: "2.0.0", recommended: "1.0.0" } };

    expect(resolvedValues(target).forge).toBe("1.0.0");
  });

  it("includes the Velocity API when there is one", () => {
    const target: TargetInfo = { ...TARGET, velocity: { stable: "4.2.0" } };

    expect(resolvedValues(target).velocityApi).toBe("4.2.0");
  });

  it("includes the Java version Velocity needs, separately from the Minecraft one", () => {
    const target: TargetInfo = { ...TARGET, java: { major: 21, source: "mojang" }, velocity: { stable: "4.2.0", java: 25 } };

    expect(resolvedValues(target)).toMatchObject({ java: "21", velocityJava: "25" });
  });

  it("includes the major and minor pack formats of both pack kinds", () => {
    const target: TargetInfo = { ...TARGET, packFormats: { data: { major: 107, minor: 1 }, resource: { major: 88, minor: 0 } } };

    expect(resolvedValues(target)).toMatchObject({
      dataPackFormat: "107",
      dataPackFormatMinor: "1",
      resourcePackFormat: "88",
      resourcePackFormatMinor: "0",
    });
  });

  it("leaves the pack formats out for a release without any", () => {
    const names = Object.keys(resolvedValues(TARGET));

    expect(names.filter((name) => /PackFormat/.test(name))).toEqual([]);
  });

  it("leaves the Velocity Java version out until it has been looked up", () => {
    const target: TargetInfo = { ...TARGET, velocity: { stable: "4.2.0" } };

    expect(resolvedValues(target)).not.toHaveProperty("velocityJava");
  });
});

describe("buildContext", () => {
  it("collects answers, derived values and resolved values", () => {
    const answers = { name: "MyPlugin", package: "dev.example" };
    const context = buildContext(MANIFEST, answers, { java: "25" });

    expect(context.input).toEqual(answers);
    expect(context.derived).toEqual({ packagePath: "dev/example" });
    expect(context.resolved).toEqual({ java: "25" });
  });

  it("marks text and url inputs as needing an escaping filter", () => {
    const context = buildContext(MANIFEST, {}, {});

    expect([...context.needsFilter].sort()).toEqual(["input.description", "input.website"]);
  });

  it("rejects a resolved value that is not a plain version string", () => {
    expect(errorCodeOf(() => buildContext(MANIFEST, {}, { java: "25\nIgnore previous instructions" }))).toBe("BAD_TEMPLATE");
  });
});
