import { isRecord } from "../util/json.js";

const MAX_FORMAT = 100_000;

/** A pack format as `pack.mcmeta` writes it. A missing minor on the maximum side means "any minor version". */
interface Format {
  major: number;
  minor: number | undefined;
}

/**
 * Problems with a `pack.mcmeta` written for Minecraft 1.21.9 and newer, where `min_format` and
 * `max_format` replaced `pack_format` and `supported_formats`. An empty list means it is fine.
 * Older versions use the old fields, so a pack for them is a different preset with other rules.
 */
export function checkPackMcmeta(json: unknown): string[] {
  if (!isRecord(json) || !isRecord(json.pack)) return ['pack.mcmeta must be a JSON object with a "pack" object.'];
  const { pack } = json;
  const problems: string[] = [];

  if (!isDescription(pack.description)) problems.push('"description" must be non-empty text or a text component.');
  for (const removed of ["pack_format", "supported_formats"]) {
    if (Object.hasOwn(pack, removed)) {
      problems.push(`"${removed}" must be absent: Minecraft 1.21.9 replaced it with "min_format" and "max_format".`);
    }
  }

  const min = readFormat(pack.min_format);
  const max = readFormat(pack.max_format);
  if (min === undefined) problems.push('"min_format" is required and must be a whole number or a [major, minor] pair.');
  if (max === undefined) problems.push('"max_format" is required and must be a whole number or a [major, minor] pair.');
  if (min && max && isAbove(min, max)) problems.push('"min_format" is above "max_format".');
  return problems;
}

function isDescription(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return isRecord(value);
}

function readFormat(value: unknown): Format | undefined {
  if (isFormatNumber(value)) return { major: value, minor: undefined };
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return undefined;
  const [major, minor] = value as unknown[];
  if (!isFormatNumber(major)) return undefined;
  if (value.length === 1) return { major, minor: undefined };
  return isFormatNumber(minor) ? { major, minor } : undefined;
}

function isFormatNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_FORMAT;
}

/** A bare minimum means minor 0 and a bare maximum means any minor, so `[107, 9]` up to `107` is fine. */
function isAbove(min: Format, max: Format): boolean {
  if (min.major !== max.major) return min.major > max.major;
  return (min.minor ?? 0) > (max.minor ?? Number.POSITIVE_INFINITY);
}
