import { describe, expect, it } from "vitest";
import { parsePresetManifest } from "../../src/presets/schema.js";
import { errorCodeOf } from "../helpers/fixtures.js";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function valid(): Record<string, unknown> {
  return {
    schema: 1,
    id: "paper-plugin-gradle",
    title: "Paper plugin (Gradle, Kotlin DSL)",
    kind: "archetype",
    family: "plugin",
    platforms: ["paper", "folia"],
    minecraft: { min: "1.20.5" },
    inputs: [
      { key: "name", type: "identifier", label: "Plugin name", example: "MyPlugin" },
      { key: "language", type: "choice", label: "Language", options: ["java", "kotlin"], default: "java" },
      { key: "description", type: "text", label: "Description", default: "" },
    ],
    files: [
      { from: "files/build.gradle.kts", to: "build.gradle.kts" },
      { from: "files/Main.kt", to: "src/main/kotlin/{{input.name}}.kt", when: { key: "language", equals: "kotlin" } },
    ],
    provenance: [{ use: "derived", repo: "jpenilla/MiniMOTD", commit: COMMIT, license: "MIT", paths: ["platform/paper/build.gradle.kts"] }],
  };
}

const withChange = (change: Record<string, unknown>): unknown => ({ ...valid(), ...change });

describe("parsePresetManifest", () => {
  it("parses a complete manifest", () => {
    const manifest = parsePresetManifest(valid());

    expect(manifest.id).toBe("paper-plugin-gradle");
    expect(manifest.platforms).toEqual(["paper", "folia"]);
    expect(manifest.minecraft).toEqual({ min: "1.20.5" });
    expect(manifest.inputs.map((input) => input.key)).toEqual(["name", "language", "description"]);
    expect(manifest.inputs[1]).toEqual({ key: "language", type: "choice", label: "Language", options: ["java", "kotlin"], default: "java" });
    expect(manifest.inputs[2]?.default).toBe("");
    expect(manifest.files[1]?.when).toEqual({ key: "language", equals: "kotlin" });
    expect(manifest.provenance[0]).toMatchObject({ use: "derived", repo: "jpenilla/MiniMOTD", license: "MIT" });
  });

  it("accepts a minimal manifest", () => {
    const manifest = parsePresetManifest({ schema: 1, id: "tiny", title: "Tiny", kind: "feature", family: "pack", platforms: ["datapack"] });

    expect(manifest).toMatchObject({ inputs: [], files: [], provenance: [], minecraft: {} });
  });

  it("accepts original work without a repository or commit", () => {
    const manifest = parsePresetManifest(withChange({ provenance: [{ use: "original", license: "MIT" }] }));

    expect(manifest.provenance[0]).toEqual({ use: "original", license: "MIT", paths: [] });
  });

  it.each([
    ["a non-object", "nope"],
    ["null", null],
    ["a wrong schema number", withChange({ schema: 2 })],
    ["an id with a space", withChange({ id: "Bad Id" })],
    ["an id that is not text", withChange({ id: 7 })],
    ["an unknown kind", withChange({ kind: "template" })],
    ["an unknown family", withChange({ family: "server" })],
    ["no platforms", withChange({ platforms: [] })],
    ["an upper-case platform", withChange({ platforms: ["Paper"] })],
    ["a title with a newline", withChange({ title: "two\nlines" })],
    ["a minecraft version with a newline", withChange({ minecraft: { min: "1.20\n" } })],
    ["inputs that are not a list", withChange({ inputs: "none" })],
  ])("rejects %s", (_label, manifest) => {
    expect(errorCodeOf(() => parsePresetManifest(manifest))).toBe("BAD_PRESET");
  });

  it("rejects an input declared twice", () => {
    const inputs = [
      { key: "name", type: "identifier", label: "Name" },
      { key: "name", type: "text", label: "Again" },
    ];

    expect(() => parsePresetManifest(withChange({ inputs }))).toThrow(/declared twice/);
  });

  it.each([
    ["an unknown input type", { key: "x", type: "number", label: "X" }],
    ["an invalid input key", { key: "Bad Key", type: "text", label: "X" }],
    ["a choice without options", { key: "x", type: "choice", label: "X" }],
    ["a choice with an empty option list", { key: "x", type: "choice", label: "X", options: [] }],
    ["a choice default outside its options", { key: "x", type: "choice", label: "X", options: ["a"], default: "b" }],
    ["a default that is not text or a boolean", { key: "x", type: "text", label: "X", default: 5 }],
    ["an optional flag that is not a boolean", { key: "x", type: "text", label: "X", optional: "yes" }],
  ])("rejects %s", (_label, input) => {
    expect(errorCodeOf(() => parsePresetManifest(withChange({ inputs: [input] })))).toBe("BAD_PRESET");
  });

  it.each([
    ["a when condition on an unknown input", [{ from: "a.txt", to: "a.txt", when: { key: "nope" } }]],
    ["a template path that escapes the preset", [{ from: "../secret", to: "a.txt" }]],
    ["an absolute template path", [{ from: "/etc/passwd", to: "a.txt" }]],
    ["a file entry without a destination", [{ from: "a.txt" }]],
    ["a when.equals that is a number", [{ from: "a.txt", to: "a.txt", when: { key: "name", equals: 3 } }]],
  ])("rejects %s", (_label, files) => {
    expect(errorCodeOf(() => parsePresetManifest(withChange({ files })))).toBe("BAD_PRESET");
  });

  it.each([
    ["a derived entry without a repository", { use: "derived", commit: COMMIT, license: "MIT" }],
    ["a derived entry without a commit", { use: "derived", repo: "a/b", license: "MIT" }],
    ["a commit that is not a full hash", { use: "derived", repo: "a/b", commit: "abc123", license: "MIT" }],
    ["a repository that is not owner/name", { use: "reference", repo: "not a repo", commit: COMMIT, license: "MIT" }],
    ["a licence with spaces", { use: "derived", repo: "a/b", commit: COMMIT, license: "MIT license" }],
    ["an unknown use", { use: "borrowed", repo: "a/b", commit: COMMIT, license: "MIT" }],
  ])("rejects %s", (_label, entry) => {
    expect(errorCodeOf(() => parsePresetManifest(withChange({ provenance: [entry] })))).toBe("BAD_PRESET");
  });
});
