import { EmdError } from "../errors.js";
import { isRecord, isVersionToken, type JsonRecord } from "../util/json.js";
import { hasControlCharacters } from "../util/text.js";
import { isSafeRelativePath } from "./paths.js";
import type {
  AnswerValue,
  Condition,
  FileSpec,
  InputSpec,
  InputType,
  PresetFamily,
  PresetKind,
  PresetManifest,
  Provenance,
  ProvenanceUse,
} from "./types.js";

const ID = /^[a-z][a-z0-9-]{1,63}$/;
const INPUT_KEY = /^[a-z][A-Za-z0-9]{0,31}$/;
const PLATFORM = /^[a-z][a-z0-9-]{0,31}$/;
const OPTION = /^[A-Za-z0-9._-]{1,32}$/;
const REPO = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SPDX_LICENSE = /^[A-Za-z0-9.+-]{1,40}$/;
const MAX_TEXT = 200;

const KINDS: readonly PresetKind[] = ["archetype", "feature"];
const FAMILIES: readonly PresetFamily[] = ["plugin", "proxy", "mod", "pack"];
const INPUT_TYPES: readonly InputType[] = ["identifier", "slug", "package", "version", "text", "url", "boolean", "choice"];
const PROVENANCE_USES: readonly ProvenanceUse[] = ["derived", "reference", "original"];

/** Validates a parsed preset.json. Everything a preset declares is checked here, before any file is rendered. */
export function parsePresetManifest(json: unknown): PresetManifest {
  if (!isRecord(json)) throw new EmdError("BAD_PRESET", "A preset manifest must be a JSON object.");
  const id = parseId(json.id);
  if (json.schema !== 1) throw bad(id, "schema must be 1");

  const platforms = list(json.platforms, id, "platforms").map((platform) => matching(platform, PLATFORM, id, "platform"));
  if (platforms.length === 0) throw bad(id, "platforms must not be empty");
  const inputs = parseInputs(json.inputs, id);

  return {
    schema: 1,
    id,
    title: text(json.title, id, "title"),
    kind: oneOf(json.kind, KINDS, id, "kind"),
    family: oneOf(json.family, FAMILIES, id, "family"),
    platforms,
    minecraft: parseMinecraft(json.minecraft, id),
    inputs,
    files: parseFiles(json.files, inputs, id),
    provenance: parseProvenance(json.provenance, id),
  };
}

function parseMinecraft(value: unknown, id: string): { min?: string; max?: string } {
  if (value === undefined) return {};
  const raw = record(value, id, "minecraft");
  const version = (entry: unknown, what: string): string => {
    const candidate = text(entry, id, what);
    if (!isVersionToken(candidate)) throw bad(id, `${what} ${JSON.stringify(candidate)} is not a version`);
    return candidate;
  };
  return {
    ...(raw.min === undefined ? {} : { min: version(raw.min, "minecraft.min") }),
    ...(raw.max === undefined ? {} : { max: version(raw.max, "minecraft.max") }),
  };
}

function parseInputs(value: unknown, id: string): InputSpec[] {
  const specs = list(value ?? [], id, "inputs").map((entry) => parseInput(entry, id));
  const keys = specs.map((spec) => spec.key);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate !== undefined) throw bad(id, `input ${JSON.stringify(duplicate)} is declared twice`);
  return specs;
}

function parseInput(entry: unknown, id: string): InputSpec {
  const raw = record(entry, id, "an input");
  const key = matching(raw.key, INPUT_KEY, id, "input key");
  const type = oneOf(raw.type, INPUT_TYPES, id, `input ${key} type`);
  const options = type === "choice" ? parseOptions(raw.options, id, key) : undefined;
  const fallback = parseDefault(raw.default, id, key);
  if (options !== undefined && typeof fallback === "string" && !options.includes(fallback)) {
    throw bad(id, `input ${key} default must be one of its options`);
  }
  if (raw.optional !== undefined && typeof raw.optional !== "boolean") throw bad(id, `input ${key} optional must be true or false`);

  return {
    key,
    type,
    label: text(raw.label, id, `input ${key} label`),
    ...(fallback === undefined ? {} : { default: fallback }),
    ...(raw.optional === true ? { optional: true } : {}),
    ...(options === undefined ? {} : { options }),
    ...(raw.example === undefined ? {} : { example: text(raw.example, id, `input ${key} example`) }),
  };
}

function parseOptions(value: unknown, id: string, key: string): string[] {
  const options = list(value, id, `input ${key} options`).map((option) => matching(option, OPTION, id, `input ${key} option`));
  if (options.length === 0) throw bad(id, `input ${key} is a choice but lists no options`);
  return options;
}

function parseDefault(value: unknown, id: string, key: string): AnswerValue | undefined {
  if (value === undefined || typeof value === "boolean") return value;
  if (typeof value === "string" && value.length <= MAX_TEXT && !hasControlCharacters(value)) return value;
  throw bad(id, `input ${key} default must be single-line text or true/false`);
}

function parseFiles(value: unknown, inputs: readonly InputSpec[], id: string): FileSpec[] {
  const keys = new Set(inputs.map((spec) => spec.key));
  return list(value ?? [], id, "files").map((entry) => {
    const raw = record(entry, id, "a file entry");
    const from = text(raw.from, id, "file from");
    if (!isSafeRelativePath(from)) throw bad(id, `file source ${JSON.stringify(from)} is not a safe relative path`);
    const when = raw.when === undefined ? undefined : parseCondition(raw.when, keys, id);
    return { from, to: text(raw.to, id, "file to"), ...(when === undefined ? {} : { when }) };
  });
}

function parseCondition(value: unknown, keys: ReadonlySet<string>, id: string): Condition {
  const raw = record(value, id, "a when condition");
  const key = matching(raw.key, INPUT_KEY, id, "when key");
  if (!keys.has(key)) throw bad(id, `when refers to unknown input ${JSON.stringify(key)}`);
  if (raw.equals === undefined) return { key };
  if (typeof raw.equals !== "string" && typeof raw.equals !== "boolean") throw bad(id, "when.equals must be text or true/false");
  return { key, equals: raw.equals };
}

function parseProvenance(value: unknown, id: string): Provenance[] {
  return list(value ?? [], id, "provenance").map((entry) => {
    const raw = record(entry, id, "a provenance entry");
    const use = oneOf(raw.use, PROVENANCE_USES, id, "provenance use");
    const license = matching(raw.license, SPDX_LICENSE, id, "provenance license");
    const paths = list(raw.paths ?? [], id, "provenance paths").map((path) => text(path, id, "provenance path"));
    if (use === "original") return { use, license, paths };
    return {
      use,
      license,
      paths,
      repo: matching(raw.repo, REPO, id, "provenance repo"),
      commit: matching(raw.commit, COMMIT, id, "provenance commit"),
    };
  });
}

function parseId(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new EmdError("BAD_PRESET", "A preset id must be lowercase letters, digits and hyphens, starting with a letter.");
  }
  return value;
}

function bad(id: string, message: string): EmdError {
  return new EmdError("BAD_PRESET", `Preset ${JSON.stringify(id)}: ${message}.`);
}

function text(value: unknown, id: string, what: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT || hasControlCharacters(value)) {
    throw bad(id, `${what} must be 1 to ${MAX_TEXT} characters of single-line text`);
  }
  return value;
}

function matching(value: unknown, pattern: RegExp, id: string, what: string): string {
  const candidate = text(value, id, what);
  if (!pattern.test(candidate)) throw bad(id, `${what} ${JSON.stringify(candidate)} is not valid`);
  return candidate;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], id: string, what: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw bad(id, `${what} must be one of ${allowed.join(", ")}`);
  return match;
}

function list(value: unknown, id: string, what: string): unknown[] {
  if (!Array.isArray(value)) throw bad(id, `${what} must be a list`);
  return value;
}

function record(value: unknown, id: string, what: string): JsonRecord {
  if (!isRecord(value)) throw bad(id, `${what} must be an object`);
  return value;
}
