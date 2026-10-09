import { parseArgs } from "node:util";
import { runVersions } from "../commands/versions.js";
import { EmdError } from "../errors.js";
import { isStableMcVersion } from "../versions/compare.js";
import type { HttpClient } from "../versions/http.js";
import { stripControlCharacters } from "./text.js";

const HELP = `emd: Everything Minecraft Development

Usage:
  emd versions [--mc <version>] [--json] [--refresh]
  emd --version
  emd --help
`;

const VERSIONS_HELP = `Usage: emd versions [--mc <version>] [--json] [--refresh]

Live Minecraft and platform versions from the official APIs.

  --mc <version>   Resolve one release in detail, for example 26.3 or 1.21.11
  --json           Print JSON instead of text
  --refresh        Ignore cached responses and fetch fresh data
`;

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

/** Everything the CLI touches outside itself, so tests can run it without a terminal or a network. */
export interface CliEnvironment {
  version: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  createHttp: (options: { refresh: boolean }) => HttpClient;
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

  throw new EmdError("USAGE", `Unknown command: ${JSON.stringify(command)}.`);
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
  if (values.mc !== undefined && !isStableMcVersion(values.mc)) {
    throw new EmdError("USAGE", `--mc expects a release such as 26.3 or 1.21.11, not ${JSON.stringify(values.mc)}.`);
  }

  const http = env.createHttp({ refresh: values.refresh === true });
  const versionsArgs = { ...(values.mc === undefined ? {} : { mc: values.mc }), json: values.json === true };
  output.print(await runVersions(versionsArgs, http));
  return EXIT_OK;
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
