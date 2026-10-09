import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runNew, type NewArgs, type NewDeps } from "../../src/commands/new.js";
import { parseMojangManifest } from "../../src/versions/mojang.js";
import { errorCodeOfAsync, fixtureHttp, fixtureJson } from "../helpers/fixtures.js";

const LATEST = parseMojangManifest(fixtureJson("mojang-manifest.json")).latestRelease;

let root: string;
let presetsDir: string;
let work: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "emd-new-"));
  presetsDir = path.join(root, "presets");
  work = path.join(root, "work");
  await mkdir(work);
  await mkdir(path.join(presetsDir, "demo-preset", "files"), { recursive: true });
  await writeFile(
    path.join(presetsDir, "demo-preset", "files", "x.txt"),
    'paper={{resolved.paperApi}} java={{resolved.java}} desc="{{input.description|json}}"\n',
  );
  await writeFile(
    path.join(presetsDir, "demo-preset", "preset.json"),
    JSON.stringify({
      schema: 1,
      id: "demo-preset",
      title: "Demo",
      kind: "archetype",
      family: "plugin",
      platforms: ["paper"],
      minecraft: { min: "1.20.5" },
      inputs: [
        { key: "name", type: "identifier", label: "Name" },
        { key: "description", type: "text", label: "Description", default: "none" },
      ],
      files: [{ from: "files/x.txt", to: "src/{{input.name}}.txt" }],
      provenance: [{ use: "original", license: "MIT" }],
    }),
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const args = (overrides: Partial<NewArgs> = {}): NewArgs => ({
  preset: "demo-preset",
  mc: LATEST,
  set: { name: "Demo" },
  force: false,
  dryRun: false,
  json: false,
  ...overrides,
});

const deps = (): NewDeps => ({ http: fixtureHttp(), presetsDir, cwd: work });

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

describe("runNew", () => {
  it("creates the files with the versions the resolver found", async () => {
    const output = await runNew(args(), deps());

    expect(output).toContain(`Created demo-preset for Minecraft ${LATEST}`);
    expect(output).toContain("  src/Demo.txt");
    expect(await readFile(path.join(work, "Demo", "src", "Demo.txt"), "utf8")).toMatch(/^paper=26\.\d+\.build\.\+ java=\d+ desc="none"\n$/);
  });

  it("shows what it would do without writing anything on a dry run", async () => {
    const output = await runNew(args({ dryRun: true }), deps());

    expect(output).toContain("Would create demo-preset");
    expect(await readdir(work)).toEqual([]);
  });

  it("prints a machine-readable summary as JSON", async () => {
    const parsed = JSON.parse(await runNew(args({ json: true }), deps())) as {
      files: string[];
      directory: string;
      dryRun: boolean;
      warnings: string[];
    };

    expect(parsed.files).toEqual(["src/Demo.txt"]);
    expect(parsed.directory).toBe(path.resolve(work, "Demo"));
    expect(parsed.dryRun).toBe(false);
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it("uses the directory it is given instead of one named after the project", async () => {
    await runNew(args({ dir: "custom" }), deps());

    expect(await exists(path.join(work, "custom", "src", "Demo.txt"))).toBe(true);
    expect(await exists(path.join(work, "Demo"))).toBe(false);
  });

  it("will not overwrite an existing project unless forced", async () => {
    await runNew(args(), deps());

    expect(await errorCodeOfAsync(() => runNew(args(), deps()))).toBe("CONFLICT");
    await expect(runNew(args({ force: true }), deps())).resolves.toContain("Created demo-preset");
  });

  it("reports an unknown preset", async () => {
    expect(await errorCodeOfAsync(() => runNew(args({ preset: "nope" }), deps()))).toBe("NOT_FOUND");
  });

  it("reports a Minecraft version that does not exist", async () => {
    expect(await errorCodeOfAsync(() => runNew(args({ mc: "27.0" }), deps()))).toBe("UNKNOWN_MC_VERSION");
  });

  it("refuses a Minecraft version older than the preset supports", async () => {
    await expect(runNew(args({ mc: "1.12.2" }), deps())).rejects.toThrow(/needs Minecraft 1\.20\.5 or newer/);
  });

  it("rejects invalid answers and writes nothing", async () => {
    expect(await errorCodeOfAsync(() => runNew(args({ set: { name: "1bad" } }), deps()))).toBe("BAD_ANSWER");
    expect(await readdir(work)).toEqual([]);
  });

  it("names the answers that are missing", async () => {
    await expect(runNew(args({ set: {} }), deps())).rejects.toThrow(/"name"/);
  });
});
