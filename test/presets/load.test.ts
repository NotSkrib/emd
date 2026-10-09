import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPreset, loadPresetById, loadPresets } from "../../src/presets/load.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "emd-presets-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function manifest(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 1,
    id,
    title: `Preset ${id}`,
    kind: "feature",
    family: "plugin",
    platforms: ["paper"],
    files: [{ from: "files/a.txt", to: "a.txt" }],
    provenance: [{ use: "original", license: "MIT" }],
    ...overrides,
  };
}

async function writePreset(
  folder: string,
  json: unknown,
  files: Record<string, string> = { "files/a.txt": "hello" },
): Promise<string> {
  const dir = path.join(root, folder);
  await mkdir(path.join(dir, "files"), { recursive: true });
  await writeFile(path.join(dir, "preset.json"), typeof json === "string" ? json : JSON.stringify(json));
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(dir, name), content);
  return dir;
}

describe("loadPreset", () => {
  it("loads the manifest and every template it lists", async () => {
    const preset = await loadPreset(await writePreset("alpha", manifest("alpha")));

    expect(preset.manifest.id).toBe("alpha");
    expect(preset.templates.get("files/a.txt")).toBe("hello");
  });

  it("reads a template once even when it is listed twice", async () => {
    const files = [
      { from: "files/a.txt", to: "one.txt" },
      { from: "files/a.txt", to: "two.txt" },
    ];
    const preset = await loadPreset(await writePreset("alpha", manifest("alpha", { files })));

    expect(preset.templates.size).toBe(1);
  });

  it("rejects a folder whose name differs from the declared id", async () => {
    const dir = await writePreset("alpha", manifest("beta"));

    expect(await errorCodeOfAsync(() => loadPreset(dir))).toBe("BAD_PRESET");
  });

  it("rejects a manifest that is not valid JSON", async () => {
    const dir = await writePreset("alpha", "{ not json");

    expect(await errorCodeOfAsync(() => loadPreset(dir))).toBe("BAD_PRESET");
  });

  it("rejects a listed template that is missing", async () => {
    const dir = await writePreset("alpha", manifest("alpha"), {});

    expect(await errorCodeOfAsync(() => loadPreset(dir))).toBe("BAD_PRESET");
  });

  it("rejects a binary template", async () => {
    const dir = await writePreset("alpha", manifest("alpha"), { "files/a.txt": "a\u0000b" });

    await expect(loadPreset(dir)).rejects.toThrow(/binary/);
  });

  it("rejects a folder with no manifest", async () => {
    await mkdir(path.join(root, "alpha"));

    expect(await errorCodeOfAsync(() => loadPreset(path.join(root, "alpha")))).toBe("BAD_PRESET");
  });
});

describe("loadPresets", () => {
  it("returns the presets sorted by id and ignores loose files", async () => {
    await writePreset("zeta", manifest("zeta"));
    await writePreset("alpha", manifest("alpha"));
    await writeFile(path.join(root, "notes.txt"), "not a preset");

    const presets = await loadPresets(root);

    expect(presets.map((preset) => preset.manifest.id)).toEqual(["alpha", "zeta"]);
  });

  it("reports a missing presets folder", async () => {
    expect(await errorCodeOfAsync(() => loadPresets(path.join(root, "does-not-exist")))).toBe("NOT_FOUND");
  });
});

describe("loadPresetById", () => {
  it("finds a preset by its id", async () => {
    await writePreset("alpha", manifest("alpha"));

    expect((await loadPresetById(root, "alpha")).manifest.title).toBe("Preset alpha");
  });

  it("lists what is available when the id is unknown", async () => {
    await writePreset("alpha", manifest("alpha"));

    await expect(loadPresetById(root, "nope")).rejects.toThrow(/Available: alpha/);
  });

  it("never uses the id to build a path", async () => {
    await writePreset("alpha", manifest("alpha"));

    expect(await errorCodeOfAsync(() => loadPresetById(root, "../alpha"))).toBe("NOT_FOUND");
  });
});
