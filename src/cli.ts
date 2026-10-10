#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCli } from "./cli/run.js";
import { createHttpClient } from "./versions/http.js";

const REPOSITORY_URL = "https://github.com/NotSkrib/emd";

function readVersion(): string {
  try {
    const manifest: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof manifest === "object" && manifest !== null && "version" in manifest ? String(manifest.version) : "unknown";
  } catch {
    return "unknown"; // The version is only shown to the user and sent in the User-Agent.
  }
}

const version = readVersion();

process.exitCode = await runCli(process.argv.slice(2), {
  version,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  createHttp: ({ refresh }) => createHttpClient({ refresh, userAgent: `emd-minecraft/${version} (+${REPOSITORY_URL})` }),
  presetsDir: fileURLToPath(new URL("../presets", import.meta.url)),
  contentDir: fileURLToPath(new URL("..", import.meta.url)),
  home: homedir(),
  cwd: process.cwd(),
});
