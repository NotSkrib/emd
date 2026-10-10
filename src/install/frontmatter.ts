import { EmdError } from "../errors.js";

export type FieldValue = string | boolean;

export interface Frontmatter {
  fields: Record<string, FieldValue>;
  body: string;
}

const KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;
const FENCE = "---";

/**
 * Reads the header of a skill or agent file. Only the flat `key: value` subset of YAML is accepted
 * (plain, quoted and true/false values), because that is all EMD's own files use, and anything
 * else, such as a nested map or a list, is more likely a mistake than something to guess at.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const lines = text.split(/(?<=\n)/);
  if (lines[0]?.trimEnd() !== FENCE) throw bad("the file must start with a --- line");
  const closing = lines.findIndex((line, index) => index > 0 && line.trimEnd() === FENCE);
  if (closing === -1) throw bad("the header has no closing --- line");

  const fields: Record<string, FieldValue> = {};
  for (const line of lines.slice(1, closing)) {
    const [key, value] = parseLine(line.trimEnd());
    if (Object.hasOwn(fields, key)) throw bad(`the key ${JSON.stringify(key)} appears twice`);
    fields[key] = value;
  }
  return { fields, body: lines.slice(closing + 1).join("") };
}

/**
 * Writes a header with every string double-quoted, so no value can be read as anything else.
 * `rawLines` are written after the fields as they are, for the few nested blocks a tool needs. They
 * must be fixed text from the code, never user input.
 */
export function serializeFrontmatter(entries: ReadonlyArray<readonly [string, FieldValue]>, rawLines: readonly string[] = []): string {
  const lines = entries.map(([key, value]) => {
    if (!KEY.test(key)) throw bad(`${JSON.stringify(key)} is not a valid key`);
    if (typeof value === "string" && /[\r\n]/.test(value)) throw bad(`the value of ${key} must be a single line`);
    return `${key}: ${typeof value === "string" ? JSON.stringify(value) : String(value)}`;
  });
  return [FENCE, ...lines, ...rawLines, FENCE, ""].join("\n");
}

function parseLine(line: string): [string, FieldValue] {
  const colon = line.indexOf(":");
  const key = colon === -1 ? "" : line.slice(0, colon);
  if (!KEY.test(key)) throw bad(`cannot read the line ${JSON.stringify(line.slice(0, 60))}`);
  const raw = line.slice(colon + 1).trim();
  if (raw === "") throw bad(`${key} has no value (nested maps and lists are not supported)`);
  return [key, parseValue(raw, key)];
}

function parseValue(raw: string, key: string): FieldValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const quote = raw[0];
  if (quote === '"') return parseDoubleQuoted(raw, key);
  if (quote === "'") return parseSingleQuoted(raw, key);
  if (/^[[{>|&*!%@`]/.test(raw)) throw bad(`${key} uses YAML syntax that is not supported`);
  return raw;
}

function parseDoubleQuoted(raw: string, key: string): string {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "string") return value;
  } catch {
    // Falls through to the error below.
  }
  throw bad(`${key} has an unterminated or invalid quoted string`);
}

function parseSingleQuoted(raw: string, key: string): string {
  if (raw.length < 2 || !raw.endsWith("'")) throw bad(`${key} has an unterminated quoted string`);
  return raw.slice(1, -1).replaceAll("''", "'");
}

function bad(message: string): EmdError {
  return new EmdError("BAD_CONTENT", `Invalid file header: ${message}.`);
}
