import { EmdError } from "../errors.js";
import { isSafeRelativePath } from "./paths.js";
import { renderTemplate } from "./render.js";
import type { FileSpec, PlannedFile, PresetManifest, RenderContext } from "./types.js";

/**
 * Works out which files a preset writes and what they contain, without touching the disk. Every
 * output path is checked, and free-text answers are kept out of paths altogether.
 */
export function planFiles(
  manifest: PresetManifest,
  templates: ReadonlyMap<string, string>,
  context: RenderContext,
): PlannedFile[] {
  const planned = manifest.files
    .filter((spec) => applies(spec, context))
    .map((spec) => planFile(manifest.id, spec, templates, context));
  assertUniquePaths(manifest.id, planned);
  return planned;
}

function planFile(id: string, spec: FileSpec, templates: ReadonlyMap<string, string>, context: RenderContext): PlannedFile {
  const template = templates.get(spec.from);
  if (template === undefined) {
    throw new EmdError("BAD_PRESET", `Preset ${JSON.stringify(id)} lists ${JSON.stringify(spec.from)}, but that template file is missing.`);
  }
  const path = renderTemplate(spec.to, withoutFreeText(context));
  if (!isSafeRelativePath(path)) {
    throw new EmdError("BAD_TEMPLATE", `Preset ${JSON.stringify(id)} would write to ${JSON.stringify(path)}, which is not a safe relative path.`);
  }
  return { path, content: renderTemplate(template, context) };
}

/** Paths may only use values that are validated identifiers, packages and versions, never free text. */
function withoutFreeText(context: RenderContext): RenderContext {
  const input = Object.fromEntries(Object.entries(context.input).filter(([key]) => !context.needsFilter.has(`input.${key}`)));
  return { ...context, input };
}

function applies(spec: FileSpec, context: RenderContext): boolean {
  if (spec.when === undefined) return true;
  const value = Object.hasOwn(context.input, spec.when.key) ? context.input[spec.when.key] : undefined;
  return spec.when.equals === undefined ? Boolean(value) : value === spec.when.equals;
}

function assertUniquePaths(id: string, planned: readonly PlannedFile[]): void {
  const lower = planned.map((file) => file.path.toLowerCase());
  const duplicate = lower.find((path, index) => lower.indexOf(path) !== index);
  if (duplicate !== undefined) {
    throw new EmdError("BAD_TEMPLATE", `Preset ${JSON.stringify(id)} would write ${JSON.stringify(duplicate)} more than once (paths are compared ignoring case, as Windows does).`);
  }
}
