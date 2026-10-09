import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { relevantWarnings, runNew, type NewArgs, type NewDeps } from "../../src/commands/new.js";
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

describe("relevantWarnings", () => {
  const warnings = [
    "Paper only has beta builds for 26.3.",
    "Folia has no build for 26.3 (newest: 26.2).",
    "NeoForge only has beta builds for 26.3.",
    "Forge has no build for 26.3.",
    "Fabric API has no build for 26.3.",
    "Minecraft 1.16.5 is older than 1.20.5. Data below that is incomplete.",
    "Using out-of-date cached data for https://example.test/x (2 days old).",
  ];

  it("keeps the platforms a preset targets, plus general warnings", () => {
    expect(relevantWarnings(warnings, ["paper", "folia"])).toEqual([warnings[0], warnings[1], warnings[5], warnings[6]]);
    expect(relevantWarnings(warnings, ["fabric"])).toEqual([warnings[4], warnings[5], warnings[6]]);
  });

  it("does not mistake NeoForge for Forge", () => {
    const forOnlyForge = relevantWarnings(warnings, ["forge"]);

    expect(forOnlyForge).toContain(warnings[3]);
    expect(forOnlyForge).not.toContain(warnings[2]);
  });

  it("keeps every warning when the preset lists no platform it can tell apart", () => {
    expect(relevantWarnings(warnings, ["paper", "folia", "velocity", "fabric", "neoforge", "forge"])).toEqual(warnings);
  });
});

describe("runNew for a proxy preset", () => {
  beforeEach(async () => {
    await mkdir(path.join(presetsDir, "proxy-demo", "files"), { recursive: true });
    await writeFile(
      path.join(presetsDir, "proxy-demo", "files", "x.txt"),
      "velocity={{resolved.velocityApi}} velocity-java={{resolved.velocityJava}} minecraft-java={{resolved.java}}\n",
    );
    await writeFile(
      path.join(presetsDir, "proxy-demo", "preset.json"),
      JSON.stringify({
        schema: 1,
        id: "proxy-demo",
        title: "Proxy demo",
        kind: "archetype",
        family: "proxy",
        platforms: ["velocity"],
        inputs: [{ key: "name", type: "identifier", label: "Name" }],
        files: [{ from: "files/x.txt", to: "x.txt" }],
        provenance: [{ use: "original", license: "MIT" }],
      }),
    );
  });

  const proxyArgs = (overrides: Partial<NewArgs> = {}): NewArgs => {
    const { mc: _ignored, ...rest } = args({ preset: "proxy-demo" });
    return { ...rest, ...overrides };
  };
  const proxyOutput = async (overrides: Partial<NewArgs> = {}): Promise<string> => {
    await runNew(proxyArgs(overrides), deps());
    return readFile(path.join(work, "Demo", "x.txt"), "utf8");
  };

  it("needs no --mc, and takes Java from the Velocity API instead of from Minecraft", async () => {
    expect(await proxyOutput()).toMatch(/^velocity=\d+\.\d+\.\d+ velocity-java=25 minecraft-java=25\n$/);
  });

  it("keeps Velocity's Java version when an older Minecraft version is given", async () => {
    expect(await proxyOutput({ mc: "1.21.11" })).toMatch(/^velocity=\d+\.\d+\.\d+ velocity-java=25 minecraft-java=21\n$/);
  });

  it("does not claim a Minecraft version in the summary when none was asked for", async () => {
    const output = await runNew(proxyArgs({ dryRun: true }), deps());

    expect(output).toContain("Would create proxy-demo in ");
    expect(output).not.toContain("for Minecraft");
  });

  it("leaves the Minecraft version out of the JSON summary when none was asked for", async () => {
    const parsed = JSON.parse(await runNew(proxyArgs({ json: true, dryRun: true }), deps())) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty("mcVersion");
  });

  it("still requires --mc for a preset that depends on the Minecraft version", async () => {
    const { mc: _ignored, ...withoutMc } = args();

    await expect(runNew(withoutMc, deps())).rejects.toThrow(/--mc is required/);
    expect(await errorCodeOfAsync(() => runNew(withoutMc, deps()))).toBe("USAGE");
  });

  it("does not look up Velocity for a preset that does not target it", async () => {
    const asked: string[] = [];
    const recording = {
      async get(url: string) {
        asked.push(url);
        return fixtureHttp().get(url);
      },
    };

    await runNew(args(), { http: recording, presetsDir, cwd: work });

    expect(asked.filter((url) => url.endsWith(".module"))).toEqual([]);
  });
});

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
