import { parseArgs } from "node:util";
import { runInstall, runStatus, runUninstall } from "../commands/install.js";
import { runNew } from "../commands/new.js";
import { runPreset } from "../commands/preset.js";
import { runVersions } from "../commands/versions.js";
import { EmdError } from "../errors.js";
import { parseToolList, TOOL_IDS, type Scope } from "../install/tools.js";
import { isStableMcVersion, LATEST_MINECRAFT } from "../versions/compare.js";
import type { HttpClient } from "../versions/http.js";
import { stripControlCharacters } from "../util/text.js";

const HELP = `emd: Everything Minecraft Development

Usage:
  emd versions [--mc <version>] [--json] [--refresh]
  emd preset list [--json]
  emd preset show <id> [--json]
  emd new --preset <id> [--mc <version>] [--set key=value ...] [--dir <path>] [--dry-run] [--force] [--json]
  emd install --tool <tools> [--scope project|user] [--dry-run] [--json]
  emd uninstall [--tool <tools>] [--scope project|user] [--dry-run] [--json]
  emd status [--tool <tools>] [--scope project|user] [--json]
  emd --version
  emd --help
`;

const VERSIONS_HELP = `Usage: emd versions [--mc <version>] [--json] [--refresh]

Live Minecraft and platform versions from the official APIs.

  --mc <version>   Resolve one release in detail, for example 26.3 or 1.21.11
  --json           Print JSON instead of text
  --refresh        Ignore cached responses and fetch fresh data
`;

const NEW_HELP = `Usage: emd new --preset <id> [--mc <version>] [options]

Creates a project from a preset, using live versions for the chosen Minecraft release.

  --preset <id>        Which preset to use (see \`emd preset list\`)
  --mc <version>       Minecraft release to target, for example 26.3, or latest. Required, except for proxy presets such as velocity-plugin
  --set key=value      Answer one of the preset's inputs (see \`emd preset show <id>\`). Repeatable.
  --dir <path>         Where to create the project. Default: a folder named after the name input
  --dry-run            Show what would be created without writing anything
  --force              Overwrite files that already exist
  --json               Print JSON instead of text
  --refresh            Ignore cached version data
`;

const INSTALL_HELP = `Usage:
  emd install --tool <tools> [--scope project|user] [--dry-run] [--json]
  emd uninstall [--tool <tools>] [--scope project|user] [--dry-run] [--json]
  emd status [--tool <tools>] [--scope project|user] [--json]

Puts EMD's skills and subagents where your AI tools read them, so the tools know how to use emd
and stop guessing Minecraft versions. Only files with EMD's marker are ever changed or removed.

  --tool <tools>   ${TOOL_IDS.join(", ")}, a comma-separated list of them, or all.
                   Required for install. uninstall and status default to all.
  --scope          project (the current folder, default) or user (your home folder)
  --dry-run        Show what would change without writing anything
  --json           Print JSON instead of text
`;

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

const SET_KEY = /^[a-z][A-Za-z0-9]*$/;

/** Everything the CLI touches outside itself, so tests can run it without a terminal or a network. */
export interface CliEnvironment {
  version: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  createHttp: (options: { refresh: boolean }) => HttpClient;
  /** Folder holding the shipped presets. */
  presetsDir: string;
  /** The root of the emd package, which holds the `skills/` and `agents/` folders. */
  contentDir: string;
  /** The home folder, where `--scope user` installs. */
  home: string;
  /** What relative paths are resolved against. */
  cwd: string;
}

interface Output {
  print: (text: string) => void;
  error: (text: string) => void;
}

/** Runs one command and returns the process exit code. It never throws. */
export async function runCli(argv: readonly string[], env: CliEnvironment): Promise<number> {
  const output: Output = {
    print: (text) => env.stdout(`${stripControlCharacters(text)}\n`),
    error: (text) => env.stderr(`${stripControlCharacters(text)}\n`),
  };
  try {
    return await dispatch(argv, env, output);
  } catch (error) {
    return reportError(error, output);
  }
}

async function dispatch(argv: readonly string[], env: CliEnvironment, output: Output): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    output.print(HELP);
    return EXIT_OK;
  }
  if (command === "--version" || command === "-v") {
    output.print(env.version);
    return EXIT_OK;
  }
  if (command === "versions") return versionsCommand(rest, env, output);
  if (command === "preset") return presetCommand(rest, env, output);
  if (command === "new") return newCommand(rest, env, output);
  if (command === "install" || command === "uninstall" || command === "status") return installerCommand(command, rest, env, output);

  throw new EmdError("USAGE", `Unknown command: ${JSON.stringify(command)}.`);
}

async function installerCommand(command: "install" | "uninstall" | "status", args: readonly string[], env: CliEnvironment, output: Output): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: {
      tool: { type: "string" },
      scope: { type: "string", default: "project" },
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help === true) {
    output.print(INSTALL_HELP);
    return EXIT_OK;
  }
  const scope = parseScope(values.scope);
  if (command === "install" && values.tool === undefined) {
    throw new EmdError("USAGE", `--tool is required, for example --tool claude. Choose from ${TOOL_IDS.join(", ")}, or all.`);
  }
  const tools = parseToolList(values.tool ?? "all");
  const common = { tools, scope, json: values.json === true };
  const deps = { contentDir: env.contentDir, cwd: env.cwd, home: env.home, version: env.version };
  const dryRun = values["dry-run"] === true;

  if (command === "status") output.print(await runStatus(common, deps));
  else if (command === "uninstall") output.print(await runUninstall({ ...common, dryRun }, deps));
  else output.print(await runInstall({ ...common, dryRun }, deps));
  return EXIT_OK;
}

async function versionsCommand(args: readonly string[], env: CliEnvironment, output: Output): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: {
      mc: { type: "string" },
      json: { type: "boolean", default: false },
      refresh: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help === true) {
    output.print(VERSIONS_HELP);
    return EXIT_OK;
  }
  const mc = values.mc === undefined ? undefined : requireMinecraft(values.mc, { allowLatest: true });
  const http = env.createHttp({ refresh: values.refresh === true });
  output.print(await runVersions({ ...(mc === undefined ? {} : { mc }), json: values.json === true }, http));
  return EXIT_OK;
}

async function presetCommand(args: readonly string[], env: CliEnvironment, output: Output): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { json: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  const [action, id, ...extra] = positionals;

  if (action === "list" && id === undefined) {
    output.print(await runPreset({ action: "list", json: values.json === true }, env.presetsDir));
    return EXIT_OK;
  }
  if (action === "show" && id !== undefined && extra.length === 0) {
    output.print(await runPreset({ action: "show", id, json: values.json === true }, env.presetsDir));
    return EXIT_OK;
  }
  throw new EmdError("USAGE", "Use `emd preset list` or `emd preset show <id>`.");
}

async function newCommand(args: readonly string[], env: CliEnvironment, output: Output): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: {
      preset: { type: "string" },
      mc: { type: "string" },
      set: { type: "string", multiple: true },
      dir: { type: "string" },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      refresh: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help === true) {
    output.print(NEW_HELP);
    return EXIT_OK;
  }
  if (values.preset === undefined) throw new EmdError("USAGE", "--preset is required. List the presets with `emd preset list`.");

  const request = {
    preset: values.preset,
    ...(values.mc === undefined ? {} : { mc: requireMinecraft(values.mc, { allowLatest: true }) }),
    set: parseSetOptions(values.set ?? []),
    ...(values.dir === undefined ? {} : { dir: values.dir }),
    force: values.force === true,
    dryRun: values["dry-run"] === true,
    json: values.json === true,
  };
  const http = env.createHttp({ refresh: values.refresh === true });
  output.print(await runNew(request, { http, presetsDir: env.presetsDir, cwd: env.cwd }));
  return EXIT_OK;
}

function parseScope(value: string | undefined): Scope {
  if (value === "project" || value === "user") return value;
  throw new EmdError("USAGE", `--scope expects project or user, not ${JSON.stringify(String(value).slice(0, 40))}.`);
}

function requireMinecraft(value: string, options: { allowLatest?: boolean } = {}): string {
  if (options.allowLatest === true && value === LATEST_MINECRAFT) return value;
  if (!isStableMcVersion(value)) {
    const expected = options.allowLatest === true ? "a release such as 26.3 or 1.21.11, or latest" : "a release such as 26.3 or 1.21.11";
    throw new EmdError("USAGE", `--mc expects ${expected}, not ${JSON.stringify(value)}.`);
  }
  return value;
}

/** Turns repeated `--set key=value` options into answers. The value may itself contain "=". */
function parseSetOptions(entries: readonly string[]): Record<string, string> {
  const answers = new Map<string, string>();
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    const key = separator > 0 ? entry.slice(0, separator) : "";
    if (!SET_KEY.test(key)) throw new EmdError("USAGE", `--set expects key=value, with a key like name or package, not ${JSON.stringify(entry.slice(0, 60))}.`);
    if (answers.has(key)) throw new EmdError("USAGE", `--set ${key} was given more than once.`);
    answers.set(key, entry.slice(separator + 1));
  }
  return Object.fromEntries(answers);
}

function reportError(error: unknown, output: Output): number {
  if (error instanceof EmdError) {
    output.error(`emd: ${describe(error)}`);
    if (error.code !== "USAGE") return EXIT_FAILURE;
    output.error(`\n${HELP}`);
    return EXIT_USAGE;
  }
  if (isParseArgsError(error)) {
    output.error(`emd: ${error.message}\n\n${HELP}`);
    return EXIT_USAGE;
  }
  output.error(`emd: unexpected error: ${String(error)}`);
  return EXIT_FAILURE;
}

function isParseArgsError(error: unknown): error is TypeError {
  return error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS");
}

/** The message plus the underlying cause, so "Could not reach ..." says whether it was DNS, TLS or a timeout. */
function describe(error: EmdError): string {
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
  return `${error.message}${cause}`;
}
