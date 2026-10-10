import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, type CliEnvironment } from "../../src/cli/run.js";
import { EmdError } from "../../src/errors.js";
import type { HttpClient } from "../../src/versions/http.js";
import { parseMojangManifest } from "../../src/versions/mojang.js";
import { fixtureHttp, fixtureJson } from "../helpers/fixtures.js";

const LATEST = parseMojangManifest(fixtureJson("mojang-manifest.json")).latestRelease;
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRESETS_DIR = path.join(REPO_ROOT, "presets");

interface Result {
  code: number;
  out: string;
  err: string;
}

async function run(argv: string[], overrides: Partial<CliEnvironment> = {}): Promise<Result> {
  let out = "";
  let err = "";
  const env: CliEnvironment = {
    version: "9.9.9",
    stdout: (text) => {
      out += text;
    },
    stderr: (text) => {
      err += text;
    },
    createHttp: () => fixtureHttp(),
    presetsDir: PRESETS_DIR,
    contentDir: REPO_ROOT,
    home: os.tmpdir(),
    cwd: os.tmpdir(),
    ...overrides,
  };
  const code = await runCli(argv, env);
  return { code, out, err };
}

const NEW_ARGS = ["new", "--preset", "paper-plugin-gradle", "--mc", LATEST, "--set", "name=Demo", "--set", "package=dev.example.demo", "--set", "author=Me"];

describe("runCli", () => {
  it("prints the version", async () => {
    expect(await run(["--version"])).toEqual({ code: 0, out: "9.9.9\n", err: "" });
  });

  it("prints help when given no arguments", async () => {
    const result = await run([]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("Usage:");
    expect(result.out).toContain("emd new");
  });

  it("rejects an unknown command with the usage exit code and the help text", async () => {
    const result = await run(["frobnicate"]);

    expect(result.code).toBe(2);
    expect(result.err).toContain("Unknown command");
    expect(result.err).toContain("Usage:");
  });

  it("prints the platform overview", async () => {
    const result = await run(["versions"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain(`Minecraft ${LATEST}`);
  });

  it("resolves one release as JSON", async () => {
    const result = await run(["versions", "--mc", LATEST, "--json"]);

    expect(result.code).toBe(0);
    expect((JSON.parse(result.out) as { mcVersion: string }).mcVersion).toBe(LATEST);
  });

  it("prints help for the versions command", async () => {
    const result = await run(["versions", "--help"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("--refresh");
  });

  it("accepts --mc latest for versions, and says so when a bad value is given", async () => {
    const latest = await run(["versions", "--mc", "latest", "--json"]);
    const bad = await run(["versions", "--mc", "newest"]);

    expect(latest.code).toBe(0);
    expect((JSON.parse(latest.out) as { mcVersion: string }).mcVersion).toBe(LATEST);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("or latest");
  });

  it("treats an empty --mc as a usage error instead of falling back to the overview", async () => {
    const result = await run(["versions", "--mc", ""]);

    expect(result.code).toBe(2);
    expect(result.err).toContain("--mc expects");
    expect(result.out).toBe("");
  });

  it("rejects a malformed --mc without contacting the network", async () => {
    let contacted = false;
    const result = await run(["versions", "--mc", "26.3; rm -rf /"], {
      createHttp: () => {
        contacted = true;
        return fixtureHttp();
      },
    });

    expect(result.code).toBe(2);
    expect(contacted).toBe(false);
  });

  it("reports an unreleased version as a failure, not a usage error", async () => {
    const result = await run(["versions", "--mc", "27.0"]);

    expect(result.code).toBe(1);
    expect(result.err).toContain("not a released version");
  });

  it("treats an unknown flag as a usage error", async () => {
    const result = await run(["versions", "--nope"]);

    expect(result.code).toBe(2);
    expect(result.err).toContain("Unknown option");
  });

  it("passes --refresh through to the HTTP client", async () => {
    const seen: boolean[] = [];
    const createHttp = ({ refresh }: { refresh: boolean }): HttpClient => {
      seen.push(refresh);
      return fixtureHttp();
    };

    await run(["versions"], { createHttp });
    await run(["versions", "--refresh"], { createHttp });

    expect(seen).toEqual([false, true]);
  });

  it("strips control characters from everything it prints", async () => {
    const result = await run(["--version"], { version: "1.0\u001b[2Kforged" });

    expect(result.out).not.toContain("\u001b");
  });

  it("includes the underlying cause of a network failure", async () => {
    const failing: HttpClient = {
      get: async () => {
        throw new EmdError("NETWORK", "Could not reach the server.", { cause: new Error("getaddrinfo ENOTFOUND piston-meta.mojang.com") });
      },
    };
    const result = await run(["versions"], { createHttp: () => failing });

    expect(result.code).toBe(1);
    expect(result.err).toContain("ENOTFOUND");
  });

  it("reports unexpected errors without crashing", async () => {
    const result = await run(["versions"], {
      createHttp: () => {
        throw new Error("boom");
      },
    });

    expect(result.code).toBe(1);
    expect(result.err).toContain("unexpected error: Error: boom");
  });
});

describe("runCli preset commands", () => {
  it("lists the shipped presets", async () => {
    const result = await run(["preset", "list"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("paper-plugin-gradle");
  });

  it("shows one preset", async () => {
    const result = await run(["preset", "show", "paper-plugin-gradle"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("Inputs");
  });

  it.each([["preset"], ["preset", "list", "extra"], ["preset", "show"], ["preset", "frob"]])("rejects `emd %s`", async (...argv) => {
    const result = await run(argv);

    expect(result.code).toBe(2);
    expect(result.err).toContain("emd preset list");
  });

  it("reports an unknown preset as a failure", async () => {
    const result = await run(["preset", "show", "nope"]);

    expect(result.code).toBe(1);
    expect(result.err).toContain("No preset called");
  });
});

describe("runCli new", () => {
  it("prints help for the new command", async () => {
    const result = await run(["new", "--help"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("--dry-run");
  });

  it("requires --preset and --mc", async () => {
    expect((await run(["new"])).err).toContain("--preset is required");
    expect((await run(["new", "--preset", "paper-plugin-gradle"])).err).toContain("--mc is required");
  });

  it("rejects a --set that is not key=value", async () => {
    const result = await run(["new", "--preset", "paper-plugin-gradle", "--mc", LATEST, "--set", "novalue"]);

    expect(result.code).toBe(2);
    expect(result.err).toContain("--set expects key=value");
  });

  it("rejects the same --set key twice", async () => {
    const result = await run(["new", "--preset", "paper-plugin-gradle", "--mc", LATEST, "--set", "name=A", "--set", "name=B"]);

    expect(result.code).toBe(2);
    expect(result.err).toContain("more than once");
  });

  it("plans a project on a dry run and lists the files as JSON", async () => {
    const result = await run([...NEW_ARGS, "--dry-run", "--json"]);

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.out) as { files: string[]; dryRun: boolean };
    expect(parsed.dryRun).toBe(true);
    expect(parsed.files).toContain("build.gradle.kts");
    expect(parsed.files).toContain("src/main/java/dev/example/demo/Demo.java");
  });

  it("accepts --mc latest", async () => {
    const argv = NEW_ARGS.map((arg) => (arg === LATEST ? "latest" : arg));
    const result = await run([...argv, "--dry-run", "--json"]);

    expect(result.code).toBe(0);
    expect((JSON.parse(result.out) as { mcVersion: string }).mcVersion).toBe(LATEST);
  });

  it("still rejects a --mc that is neither a release nor latest", async () => {
    for (const bad of ["Latest", "newest", "26.3-snapshot", "latest "]) {
      const argv = NEW_ARGS.map((arg) => (arg === LATEST ? bad : arg));
      const result = await run([...argv, "--dry-run"]);

      expect(result.code, bad).toBe(2);
      expect(result.err, bad).toContain("--mc expects");
    }
  });

  it("keeps an equals sign inside a --set value", async () => {
    const result = await run([...NEW_ARGS, "--set", "description=a=b", "--dry-run"]);

    expect(result.code).toBe(0);
  });

  it("reports invalid answers as a failure", async () => {
    const result = await run(["new", "--preset", "paper-plugin-gradle", "--mc", LATEST, "--set", "name=1bad", "--set", "package=dev.x", "--set", "author=Me", "--dry-run"]);

    expect(result.code).toBe(1);
    expect(result.err).toContain('"name"');
  });
});

describe("runCli install, uninstall and status", () => {
  let base: string;
  let overrides: Partial<CliEnvironment>;

  beforeEach(async () => {
    base = await mkdtemp(path.join(os.tmpdir(), "emd-cli-install-"));
    overrides = { contentDir: path.join(base, "content"), cwd: path.join(base, "project"), home: path.join(base, "home") };
    await mkdir(path.join(base, "project"), { recursive: true });
    await mkdir(path.join(base, "content", "skills", "emd-one"), { recursive: true });
    await writeFile(path.join(base, "content", "skills", "emd-one", "SKILL.md"), '---\nname: emd-one\ndescription: "One."\n---\nBody\n');
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it("requires --tool for install and lists the choices", async () => {
    const result = await run(["install"], overrides);

    expect(result.code).toBe(2);
    expect(result.err).toContain("--tool is required");
    expect(result.err).toContain("claude");
    expect(result.err).toContain("antigravity");
  });

  it("rejects an unknown tool and an unknown scope", async () => {
    expect((await run(["install", "--tool", "vim"], overrides)).code).toBe(2);
    const scope = await run(["install", "--tool", "claude", "--scope", "everywhere"], overrides);

    expect(scope.code).toBe(2);
    expect(scope.err).toContain("--scope expects project or user");
  });

  it("installs into the working folder, then reports it unchanged", async () => {
    const first = await run(["install", "--tool", "claude"], overrides);
    const again = await run(["install", "--tool", "claude"], overrides);

    expect(first.code).toBe(0);
    expect(await readFile(path.join(base, "project", ".claude", "skills", "emd-one", "SKILL.md"), "utf8")).toContain("emd-managed 9.9.9");
    expect(again.out).toContain("unchanged  .claude/skills/emd-one");
  });

  it("plans without writing on --dry-run and prints JSON on request", async () => {
    const result = await run(["install", "--tool", "codex", "--dry-run", "--json"], overrides);

    expect(result.code).toBe(0);
    expect((JSON.parse(result.out) as { dryRun: boolean }).dryRun).toBe(true);
    expect(await readFile(path.join(base, "project", ".agents", "skills", "emd-one", "SKILL.md")).then(() => true, () => false)).toBe(false);
  });

  it("uses the home folder for --scope user", async () => {
    await run(["install", "--tool", "codex", "--scope", "user"], overrides);

    expect(await readFile(path.join(base, "home", ".agents", "skills", "emd-one", "SKILL.md"), "utf8")).toContain("emd-managed");
  });

  it("reports a conflict as a failure, not a usage error", async () => {
    await mkdir(path.join(base, "project", ".claude", "skills", "emd-one"), { recursive: true });
    await writeFile(path.join(base, "project", ".claude", "skills", "emd-one", "SKILL.md"), "mine\n");

    const result = await run(["install", "--tool", "claude"], overrides);

    expect(result.code).toBe(1);
    expect(result.err).toContain("Nothing was changed");
  });

  it("reports status and uninstalls without needing --tool", async () => {
    await run(["install", "--tool", "claude"], overrides);

    const status = await run(["status"], overrides);
    const removed = await run(["uninstall"], overrides);

    expect(status.out).toContain(".claude/skills/emd-one");
    expect(removed.out).toContain("Removed");
    expect(await readFile(path.join(base, "project", ".claude", "skills", "emd-one", "SKILL.md")).then(() => true, () => false)).toBe(false);
  });

  it("mentions the new commands in the help", async () => {
    const result = await run(["--help"]);

    expect(result.out).toContain("emd install");
    expect(result.out).toContain("emd uninstall");
    expect(result.out).toContain("emd status");
  });
});
