import { loadPresetById, loadPresets, type LoadedPreset } from "../presets/load.js";
import type { InputSpec, PresetManifest } from "../presets/types.js";

export interface PresetArgs {
  action: "list" | "show";
  /** The preset to show. Required for "show". */
  id?: string;
  json: boolean;
}

export async function runPreset(args: PresetArgs, presetsDir: string): Promise<string> {
  if (args.action === "list") {
    const presets = await loadPresets(presetsDir);
    return args.json ? toJson(presets.map(summarise)) : formatList(presets);
  }
  const preset = await loadPresetById(presetsDir, args.id ?? "");
  return args.json ? toJson(preset.manifest) : formatDetails(preset.manifest);
}

function summarise({ manifest }: LoadedPreset): Pick<PresetManifest, "id" | "title" | "kind" | "family" | "platforms" | "minecraft"> {
  const { id, title, kind, family, platforms, minecraft } = manifest;
  return { id, title, kind, family, platforms, minecraft };
}

function formatList(presets: readonly LoadedPreset[]): string {
  if (presets.length === 0) return "No presets are installed.";
  const idWidth = Math.max(...presets.map(({ manifest }) => manifest.id.length));
  return presets
    .map(({ manifest }) => `${manifest.id.padEnd(idWidth)}  ${manifest.family.padEnd(7)}  ${manifest.platforms.join(", ")}  ${manifest.title}`)
    .join("\n");
}

function formatDetails(manifest: PresetManifest): string {
  const { min, max } = manifest.minecraft;
  const range = [min ? `${min} or newer` : undefined, max ? `up to ${max}` : undefined].filter((part) => part !== undefined).join(", ");
  const lines = [
    `${manifest.id}: ${manifest.title}`,
    `  ${manifest.kind}, family ${manifest.family}, platforms ${manifest.platforms.join(", ")}`,
    `  Minecraft ${range || "any version"}`,
    "",
    "Inputs (pass with --set key=value):",
    ...manifest.inputs.map(formatInput),
    "",
    `Files: ${manifest.files.length}`,
    ...manifest.provenance.map(
      (entry) => `Source: ${entry.use} ${entry.repo ? `from ${entry.repo}@${entry.commit?.slice(0, 7) ?? "?"} ` : ""}(${entry.license})`,
    ),
  ];
  return lines.join("\n");
}

function formatInput(spec: InputSpec): string {
  const need = spec.default !== undefined ? `default ${JSON.stringify(spec.default)}` : spec.optional === true ? "optional" : "required";
  const options = spec.options ? ` [${spec.options.join("|")}]` : "";
  const example = spec.example ? `  e.g. ${spec.example}` : "";
  return `  ${spec.key.padEnd(12)} ${spec.type.padEnd(10)} ${need}${options}${example}  (${spec.label})`;
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
