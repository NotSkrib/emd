import { describe, expect, it } from "vitest";
import { buildContext } from "../../src/presets/context.js";
import { planFiles } from "../../src/presets/plan.js";
import { parsePresetManifest } from "../../src/presets/schema.js";
import type { AnswerValue } from "../../src/presets/types.js";
import { errorCodeOf } from "../helpers/fixtures.js";

function manifest(files: unknown[]): ReturnType<typeof parsePresetManifest> {
  return parsePresetManifest({
    schema: 1,
    id: "plan-fixture",
    title: "Plan fixture",
    kind: "archetype",
    family: "plugin",
    platforms: ["paper"],
    inputs: [
      { key: "name", type: "identifier", label: "Name" },
      { key: "package", type: "package", label: "Package" },
      { key: "description", type: "text", label: "Description", default: "" },
      { key: "folia", type: "boolean", label: "Folia", default: false },
      { key: "language", type: "choice", label: "Language", options: ["java", "kotlin"], default: "java" },
    ],
    files,
  });
}

const ANSWERS: Record<string, AnswerValue> = {
  name: "MyPlugin",
  package: "dev.example",
  description: 'has "quotes"',
  folia: true,
  language: "java",
};
const RESOLVED = { java: "25", paperApi: "26.3.build.+" };

function plan(files: unknown[], templates: Array<[string, string]>, answers: Record<string, AnswerValue> = ANSWERS) {
  const preset = manifest(files);
  return planFiles(preset, new Map(templates), buildContext(preset, answers, RESOLVED));
}

describe("planFiles", () => {
  it("renders output paths and file contents", () => {
    const planned = plan(
      [{ from: "files/Main.java", to: "src/main/java/{{derived.packagePath}}/{{input.name}}.java" }],
      [["files/Main.java", 'package {{input.package}}; // java {{resolved.java}} "{{input.description|java}}"\n']],
    );

    expect(planned).toEqual([
      { path: "src/main/java/dev/example/MyPlugin.java", content: 'package dev.example; // java 25 "has \\"quotes\\""\n' },
    ]);
  });

  it("includes a file only when its condition holds", () => {
    const files = [
      { from: "files/folia.txt", to: "folia.txt", when: { key: "folia" } },
      { from: "files/kotlin.txt", to: "kotlin.txt", when: { key: "language", equals: "kotlin" } },
    ];
    const templates: Array<[string, string]> = [
      ["files/folia.txt", "folia"],
      ["files/kotlin.txt", "kotlin"],
    ];

    expect(plan(files, templates).map((file) => file.path)).toEqual(["folia.txt"]);
    expect(plan(files, templates, { ...ANSWERS, folia: false, language: "kotlin" }).map((file) => file.path)).toEqual(["kotlin.txt"]);
  });

  it("rejects a listed template that does not exist", () => {
    expect(errorCodeOf(() => plan([{ from: "files/missing.txt", to: "a.txt" }], []))).toBe("BAD_PRESET");
  });

  it("rejects an output path that would leave the project", () => {
    const run = (): unknown => plan([{ from: "files/a.txt", to: "../{{input.name}}.txt" }], [["files/a.txt", "x"]]);

    expect(errorCodeOf(run)).toBe("BAD_TEMPLATE");
  });

  it("keeps free-text answers out of paths, even with a filter", () => {
    const run = (): unknown => plan([{ from: "files/a.txt", to: "{{input.description|json}}.txt" }], [["files/a.txt", "x"]]);

    expect(errorCodeOf(run)).toBe("BAD_TEMPLATE");
  });

  it("rejects two files that would land on the same path, ignoring case", () => {
    const files = [
      { from: "files/a.txt", to: "Readme.md" },
      { from: "files/b.txt", to: "README.md" },
    ];

    expect(() => plan(files, [["files/a.txt", "a"], ["files/b.txt", "b"]])).toThrow(/more than once/);
  });

  it("fails clearly when a path needs a platform the resolver does not have", () => {
    const run = (): unknown => plan([{ from: "files/a.txt", to: "x-{{resolved.fabricApi}}.txt" }], [["files/a.txt", "x"]]);

    expect(run).toThrow(/has no value/);
  });

  it("fails clearly when a template needs a missing value", () => {
    const run = (): unknown => plan([{ from: "files/a.txt", to: "a.txt" }], [["files/a.txt", "{{resolved.neoforge}}"]]);

    expect(run).toThrow(/has no value/);
  });
});
