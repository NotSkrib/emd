import path from "node:path";
import { EmdError } from "../errors.js";
import { validateAnswers } from "../presets/answers.js";
import { buildContext, resolvedValues } from "../presets/context.js";
import { loadPresetById } from "../presets/load.js";
import { planFiles } from "../presets/plan.js";
import type { AnswerValue, PlannedFile, PresetManifest } from "../presets/types.js";
import { writeProject } from "../presets/write.js";
import { compareDotted } from "../versions/compare.js";
import type { HttpClient } from "../versions/http.js";
import {
  fetchJavaRequirement,
  fetchSourceData,
  fetchVelocityJava,
  resolveTarget,
  withVelocityJava,
  type TargetInfo,
} from "../versions/resolver.js";

export interface NewArgs {
  preset: string;
  /** The Minecraft release to target. Only a proxy preset may leave it out. */
  mc?: string;
  /** Answers given as `--set key=value`. */
  set: Readonly<Record<string, AnswerValue>>;
  /** Where to create the project. Defaults to a folder named after the `name` answer. */
  dir?: string;
  force: boolean;
  dryRun: boolean;
  json: boolean;
}

export interface NewDeps {
  http: HttpClient;
  presetsDir: string;
  cwd: string;
}

/** Creates a project from a preset: resolves live versions, validates the answers, plans the files, then writes them. */
export async function runNew(args: NewArgs, deps: NewDeps): Promise<string> {
  const preset = await loadPresetById(deps.presetsDir, args.preset);
  const { manifest } = preset;
  if (args.mc === undefined && manifest.family !== "proxy") {
    throw new EmdError("USAGE", `--mc is required for ${manifest.id}, for example --mc 26.3.`);
  }
  if (args.mc !== undefined) assertSupportedMinecraft(manifest, args.mc);

  const { data, warnings: sourceWarnings } = await fetchSourceData(deps.http);
  // A proxy is not tied to one Minecraft version, so without --mc the newest release stands in for it.
  const mcVersion = args.mc ?? data.manifest.latestRelease;
  const java = await fetchJavaRequirement(deps.http, data.manifest, mcVersion);
  const resolved = resolveTarget(data, mcVersion, java);
  const target = await withVelocityNeeds(resolved, manifest, deps.http);

  const answers = validateAnswers(manifest, args.set);
  const context = buildContext(manifest, answers, resolvedValues(target));
  const files = planFiles(manifest, preset.templates, context);

  const directory = path.resolve(deps.cwd, args.dir ?? defaultDirectory(answers));
  if (!args.dryRun) await writeProject(directory, files, { force: args.force });

  const warnings = relevantWarnings([...sourceWarnings, ...target.warnings], manifest.platforms);
  const result = {
    preset: manifest.id,
    ...(args.mc === undefined ? {} : { mcVersion: args.mc }),
    directory,
    dryRun: args.dryRun,
    files,
    warnings,
  };
  return args.json ? JSON.stringify({ ...result, files: files.map((file) => file.path) }, null, 2) : formatResult(result);
}

/** Looks up what Velocity itself needs, but only for a preset that targets it. */
async function withVelocityNeeds(target: TargetInfo, manifest: PresetManifest, http: HttpClient): Promise<TargetInfo> {
  if (!manifest.platforms.includes("velocity") || !target.velocity) return target;
  return withVelocityJava(target, await fetchVelocityJava(http, target.velocity.stable));
}

const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  paper: "Paper",
  folia: "Folia",
  velocity: "Velocity",
  fabric: "Fabric",
  neoforge: "NeoForge",
  forge: "Forge",
};

/** Keeps the warnings about the platforms a preset targets, plus general ones such as a stale cache or an old Minecraft version. */
export function relevantWarnings(warnings: readonly string[], platforms: readonly string[]): string[] {
  const otherLabels = Object.entries(PLATFORM_LABELS)
    .filter(([platform]) => !platforms.includes(platform))
    .map(([, label]) => label);
  return warnings.filter((warning) => !otherLabels.some((label) => warning.startsWith(`${label} `)));
}

function assertSupportedMinecraft(manifest: PresetManifest, mcVersion: string): void {
  const { min, max } = manifest.minecraft;
  if (min !== undefined && compareDotted(mcVersion, min) < 0) {
    throw new EmdError("USAGE", `${manifest.id} needs Minecraft ${min} or newer, not ${mcVersion}.`);
  }
  if (max !== undefined && compareDotted(mcVersion, max) > 0) {
    throw new EmdError("USAGE", `${manifest.id} supports Minecraft up to ${max}, not ${mcVersion}.`);
  }
}

function defaultDirectory(answers: Readonly<Record<string, AnswerValue>>): string {
  return typeof answers.name === "string" ? answers.name : ".";
}

interface Result {
  preset: string;
  mcVersion?: string;
  directory: string;
  dryRun: boolean;
  files: readonly PlannedFile[];
  warnings: readonly string[];
}

function formatResult(result: Result): string {
  const verb = result.dryRun ? "Would create" : "Created";
  const lines = [
    `${verb} ${result.preset}${result.mcVersion === undefined ? "" : ` for Minecraft ${result.mcVersion}`} in ${result.directory} (${result.files.length} files):`,
    ...result.files.map((file) => `  ${file.path}`),
    ...(result.warnings.length === 0 ? [] : ["", "Warnings:", ...result.warnings.map((warning) => `  - ${warning}`)]),
  ];
  return lines.join("\n");
}
