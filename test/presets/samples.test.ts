import { describe, expect, it } from "vitest";
import { sampleAnswers } from "../../src/presets/samples.js";
import { parsePresetManifest } from "../../src/presets/schema.js";

const manifest = parsePresetManifest({
  schema: 1,
  id: "samples-fixture",
  title: "Samples fixture",
  kind: "archetype",
  family: "plugin",
  platforms: ["paper"],
  inputs: [
    { key: "name", type: "identifier", label: "Name", example: "MyPlugin" },
    { key: "version", type: "version", label: "Version", default: "0.1.0", example: "9.9.9" },
    { key: "folia", type: "boolean", label: "Folia", default: false },
    { key: "language", type: "choice", label: "Language", options: ["java", "kotlin"], default: "java" },
    { key: "website", type: "url", label: "Website", optional: true },
    { key: "author", type: "text", label: "Author" },
  ],
});

describe("sampleAnswers", () => {
  it("uses the default, or the example when there is no default", () => {
    expect(sampleAnswers(manifest)).toMatchObject({ name: "MyPlugin", version: "0.1.0", language: "java" });
  });

  it("prefers the default over the example", () => {
    expect(sampleAnswers(manifest).version).toBe("0.1.0");
  });

  it("keeps a default of false", () => {
    expect(sampleAnswers(manifest)).toHaveProperty("folia", false);
  });

  it("leaves out an input that has neither, whether it is optional or required", () => {
    const answers = sampleAnswers(manifest);

    expect(answers).not.toHaveProperty("website");
    expect(answers).not.toHaveProperty("author");
  });

  it("returns a plain object that does not change the manifest", () => {
    const before = JSON.stringify(manifest);

    sampleAnswers(manifest);

    expect(JSON.stringify(manifest)).toBe(before);
  });
});
