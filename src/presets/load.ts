import { readdir } from "node:fs/promises";
import path from "node:path";
import { EmdError } from "../errors.js";
import { readRegularText } from "../util/files.js";
import { parsePresetManifest } from "./schema.js";
import type { PresetManifest } from "./types.js";

const MANIFEST_FILE = "preset.json";
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_TEMPLATE_BYTES = 1024 * 1024;
const MAX_SHOWN_ID_LENGTH = 64;

export interface LoadedPreset {
  manifest: PresetManifest;
  /** Template contents keyed by the `from` path the manifest uses. */
  templates: ReadonlyMap<string, string>;
}

/** Loads one preset folder: its manifest and every template the manifest lists. Links and binary files are refused. */
export async function loadPreset(dir: string): Promise<LoadedPreset> {
  const name = path.basename(dir);
  const raw = await readRegularFile(path.join(dir, MANIFEST_FILE), MAX_MANIFEST_BYTES, `${name}/${MANIFEST_FILE}`);
  const manifest = parsePresetManifest(parseJson(raw, name));
  if (manifest.id !== name) {
    throw new EmdError("BAD_PRESET", `Preset folder ${JSON.stringify(name)} declares the id ${JSON.stringify(manifest.id)}. They must match.`);
  }

  const sources = [...new Set(manifest.files.map((file) => file.from))];
  const entries = await Promise.all(
    sources.map(async (from): Promise<[string, string]> => {
      const content = await readRegularFile(path.join(dir, ...from.split("/")), MAX_TEMPLATE_BYTES, `${name}/${from}`);
      if (content.includes("\u0000")) throw new EmdError("BAD_PRESET", `${name}/${from} is a binary file. Templates must be text.`);
      return [from, content];
    }),
  );
  return { manifest, templates: new Map(entries) };
}

/** Every preset under `root`, sorted by id. Anything that is not a plain folder is ignored. */
export async function loadPresets(root: string): Promise<LoadedPreset[]> {
  const folders = await listFolders(root);
  const presets = await Promise.all(folders.map((folder) => loadPreset(path.join(root, folder))));
  return presets.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

/** Looks the id up among the loaded presets, so a user-supplied id is never used to build a path. */
export async function loadPresetById(root: string, id: string): Promise<LoadedPreset> {
  const presets = await loadPresets(root);
  const found = presets.find((preset) => preset.manifest.id === id);
  if (found === undefined) {
    const available = presets.map((preset) => preset.manifest.id).join(", ") || "none";
    throw new EmdError("NOT_FOUND", `No preset called ${JSON.stringify(id.slice(0, MAX_SHOWN_ID_LENGTH))}. Available: ${available}.`);
  }
  return found;
}

async function listFolders(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (cause) {
    throw new EmdError("NOT_FOUND", `No presets folder at ${root}.`, { cause });
  }
}

function readRegularFile(file: string, maxBytes: number, label: string): Promise<string> {
  return readRegularText(file, maxBytes, label, "BAD_PRESET");
}

function parseJson(raw: string, name: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new EmdError("BAD_PRESET", `${name}/${MANIFEST_FILE} is not valid JSON.`, { cause });
  }
}
