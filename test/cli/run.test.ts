import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli, type CliEnvironment } from "../../src/cli/run.js";
import { EmdError } from "../../src/errors.js";
import type { HttpClient } from "../../src/versions/http.js";
import { parseMojangManifest } from "../../src/versions/mojang.js";
import { fixtureHttp, fixtureJson } from "../helpers/fixtures.js";

const LATEST = parseMojangManifest(fixtureJson("mojang-manifest.json")).latestRelease;
const PRESETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "presets");

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
