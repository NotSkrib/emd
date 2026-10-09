import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPreset } from "../../src/commands/preset.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "emd-preset-cmd-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writePreset(id: string, title: string): Promise<void> {
  const dir = path.join(root, id);
  await mkdir(path.join(dir, "files"), { recursive: true });
  await writeFile(path.join(dir, "files", "a.txt"), "hello");
  await writeFile(
    path.join(dir, "preset.json"),
    JSON.stringify({
      schema: 1,
      id,
      title,
      kind: "archetype",
      family: "plugin",
      platforms: ["paper", "folia"],
      minecraft: { min: "1.20.5" },
      inputs: [
        { key: "name", type: "identifier", label: "Plugin name", example: "MyPlugin" },
        { key: "language", type: "choice", label: "Language", options: ["java", "kotlin"], default: "java" },
      ],
      files: [{ from: "files/a.txt", to: "a.txt" }],
      provenance: [{ use: "original", license: "MIT" }],
    }),
  );
}

describe("runPreset list", () => {
  it("lists each preset with its family, platforms and title", async () => {
    await writePreset("beta-plugin", "Beta plugin");
    await writePreset("alpha-plugin", "Alpha plugin");

    const output = await runPreset({ action: "list", json: false }, root);

    expect(output.split("\n")).toHaveLength(2);
    expect(output.indexOf("alpha-plugin")).toBeLessThan(output.indexOf("beta-plugin"));
    expect(output).toContain("paper, folia");
    expect(output).toContain("Alpha plugin");
  });

  it("lists presets as JSON", async () => {
    await writePreset("alpha-plugin", "Alpha plugin");

    const parsed = JSON.parse(await runPreset({ action: "list", json: true }, root)) as Array<{ id: string; platforms: string[] }>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "alpha-plugin", platforms: ["paper", "folia"] });
  });

  it("says so when no presets are installed", async () => {
    expect(await runPreset({ action: "list", json: false }, root)).toBe("No presets are installed.");
  });
});

describe("runPreset show", () => {
  it("describes the inputs, the Minecraft range and the source", async () => {
    await writePreset("alpha-plugin", "Alpha plugin");

    const output = await runPreset({ action: "show", id: "alpha-plugin", json: false }, root);

    expect(output).toContain("alpha-plugin: Alpha plugin");
    expect(output).toContain("Minecraft 1.20.5 or newer");
    expect(output).toContain("e.g. MyPlugin");
    expect(output).toContain('default "java"');
    expect(output).toContain("[java|kotlin]");
    expect(output).toContain("Files: 1");
    expect(output).toContain("Source: original (MIT)");
  });

  it("shows the whole manifest as JSON", async () => {
    await writePreset("alpha-plugin", "Alpha plugin");

    const parsed = JSON.parse(await runPreset({ action: "show", id: "alpha-plugin", json: true }, root)) as { id: string; files: unknown[] };

    expect(parsed.id).toBe("alpha-plugin");
    expect(parsed.files).toHaveLength(1);
  });

  it("reports an unknown preset", async () => {
    await writePreset("alpha-plugin", "Alpha plugin");

    expect(await errorCodeOfAsync(() => runPreset({ action: "show", id: "nope", json: false }, root))).toBe("NOT_FOUND");
  });
});
