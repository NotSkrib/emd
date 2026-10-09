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
import { fetchJavaRequirement, fetchSourceData, resolveTarget } from "../versions/resolver.js";

export interface NewArgs {
  preset: string;
  /** The Minecraft release to target. */
  mc: string;
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
  assertSupportedMinecraft(preset.manifest, args.mc);

  const { data, warnings: sourceWarnings } = await fetchSourceData(deps.http);
  const java = await fetchJavaRequirement(deps.http, data.manifest, args.mc);
  const target = resolveTarget(data, args.mc, java);

  const answers = validateAnswers(preset.manifest, args.set);
  const context = buildContext(preset.manifest, answers, resolvedValues(target));
  const files = planFiles(preset.manifest, preset.templates, context);

  const directory = path.resolve(deps.cwd, args.dir ?? defaultDirectory(answers));
  if (!args.dryRun) await writeProject(directory, files, { force: args.force });

  const result = { preset: preset.manifest.id, mcVersion: args.mc, directory, dryRun: args.dryRun, files, warnings: [...sourceWarnings, ...target.warnings] };
  return args.json ? JSON.stringify({ ...result, files: files.map((file) => file.path) }, null, 2) : formatResult(result);
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
  mcVersion: string;
  directory: string;
  dryRun: boolean;
  files: readonly PlannedFile[];
  warnings: readonly string[];
}

function formatResult(result: Result): string {
  const verb = result.dryRun ? "Would create" : "Created";
  const lines = [
    `${verb} ${result.preset} for Minecraft ${result.mcVersion} in ${result.directory} (${result.files.length} files):`,
    ...result.files.map((file) => `  ${file.path}`),
    ...(result.warnings.length === 0 ? [] : ["", "Warnings:", ...result.warnings.map((warning) => `  - ${warning}`)]),
  ];
  return lines.join("\n");
}
