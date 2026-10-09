import { describe, expect, it } from "vitest";
import { lintManifest } from "../../src/presets/lint.js";
import { parsePresetManifest } from "../../src/presets/schema.js";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function preset(provenance: unknown[], files: unknown[] = [{ from: "files/a.txt", to: "a.txt" }]): ReturnType<typeof parsePresetManifest> {
  return parsePresetManifest({
    schema: 1,
    id: "lint-fixture",
    title: "Lint fixture",
    kind: "feature",
    family: "plugin",
    platforms: ["paper"],
    files,
    provenance,
  });
}

const derived = (license: string): unknown => ({ use: "derived", repo: "owner/project", commit: COMMIT, license });

describe("lintManifest", () => {
  it.each(["MIT", "Apache-2.0", "CC0-1.0", "BSD-3-Clause", "ISC"])("allows deriving from %s code", (license) => {
    expect(lintManifest(preset([derived(license)]))).toEqual([]);
  });

  it.each(["GPL-3.0", "AGPL-3.0", "LGPL-3.0", "OSL-3.0", "NOASSERTION", "PolyForm-Shield-1.0.0"])(
    "blocks deriving from %s code",
    (license) => {
      const problems = lintManifest(preset([derived(license)]));

      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(license);
      expect(problems[0]).toContain("owner/project");
    },
  );

  it("allows reference reading of any licence", () => {
    const entry = { use: "reference", repo: "owner/project", commit: COMMIT, license: "GPL-3.0" };

    expect(lintManifest(preset([entry]))).toEqual([]);
  });

  it("allows original work", () => {
    expect(lintManifest(preset([{ use: "original", license: "MIT" }]))).toEqual([]);
  });

  it("requires provenance when a preset ships files", () => {
    expect(lintManifest(preset([]))).toEqual([expect.stringContaining("no provenance")]);
  });

  it("does not require provenance for a preset without files", () => {
    expect(lintManifest(preset([], []))).toEqual([]);
  });

  it("reports every offending entry", () => {
    const problems = lintManifest(preset([derived("GPL-3.0"), derived("AGPL-3.0"), derived("MIT")]));

    expect(problems).toHaveLength(2);
  });
});
