import { EmdError } from "../errors.js";
import { isVersionToken } from "../util/json.js";
import { hasControlCharacters } from "../util/text.js";
import type { AnswerValue, Answers, InputSpec, PresetManifest } from "./types.js";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]{0,31}$/;
/** A mod id: 2 to 64 lowercase letters, digits and underscores, starting with a letter. */
const SLUG = /^[a-z][a-z0-9_]{1,63}$/;
const PACKAGE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;
const MAX_TEXT = 200;
const MAX_PACKAGE = 100;

const JAVA_RESERVED: ReadonlySet<string> = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
  "default", "do", "double", "else", "enum", "extends", "false", "final", "finally", "float", "for", "goto",
  "if", "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "null", "package",
  "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized",
  "this", "throw", "throws", "transient", "true", "try", "void", "volatile", "while",
]);

type Coerced = { ok: true; value: AnswerValue | undefined } | { ok: false; problem: string };

/**
 * Checks the caller's answers against the preset's inputs and fills in defaults. Every problem is
 * reported at once, and an answer the preset does not ask for is an error, so typos are never ignored.
 */
export function validateAnswers(manifest: PresetManifest, raw: Readonly<Record<string, AnswerValue>>): Answers {
  const known = manifest.inputs.map((spec) => spec.key);
  const unknown = Object.keys(raw)
    .filter((key) => !known.includes(key))
    .map((key) => `Unknown input ${JSON.stringify(key)}. This preset accepts: ${known.join(", ") || "nothing"}.`);
  const results = manifest.inputs.map((spec) => ({ spec, result: coerceInput(spec, raw) }));
  const problems = [...unknown, ...results.flatMap(({ result }) => (result.ok ? [] : [result.problem]))];
  if (problems.length > 0) throw new EmdError("BAD_ANSWER", problems.join("\n"));

  return Object.fromEntries(
    results.flatMap(({ spec, result }) => (result.ok && result.value !== undefined ? [[spec.key, result.value] as const] : [])),
  );
}

function coerceInput(spec: InputSpec, raw: Readonly<Record<string, AnswerValue>>): Coerced {
  const given = Object.hasOwn(raw, spec.key) ? raw[spec.key] : undefined;
  const value = given ?? spec.default;
  if (value === undefined) return spec.optional === true ? { ok: true, value: undefined } : problem(spec, "is required");
  return coerceValue(spec, value);
}

function coerceValue(spec: InputSpec, value: AnswerValue): Coerced {
  switch (spec.type) {
    case "boolean":
      return toBoolean(spec, value);
    case "url":
      return toUrl(spec, value);
    case "identifier":
      return checked(spec, value, (candidate) => IDENTIFIER.test(candidate) && !JAVA_RESERVED.has(candidate), "letters and digits starting with a letter, and not a Java keyword");
    case "slug":
      return checked(spec, value, (candidate) => SLUG.test(candidate), "2 to 64 lowercase letters, digits and underscores, starting with a letter");
    case "package":
      return checked(spec, value, isPackage, "a lowercase Java package such as dev.example.plugin, with no Java keywords");
    case "version":
      return checked(spec, value, (candidate) => VERSION.test(candidate) && isVersionToken(candidate), "a version such as 0.1.0");
    case "choice":
      return checked(spec, value, (candidate) => spec.options?.includes(candidate) === true, `one of ${spec.options?.join(", ") ?? "its options"}`);
    case "text":
      return checked(spec, value, (candidate) => candidate.length <= MAX_TEXT && !hasControlCharacters(candidate), `single-line text of at most ${MAX_TEXT} characters`);
  }
}

function checked(spec: InputSpec, value: AnswerValue, isValid: (candidate: string) => boolean, expectation: string): Coerced {
  if (typeof value !== "string") return problem(spec, `must be text: ${expectation}`);
  return isValid(value) ? ok(value) : problem(spec, `must be ${expectation}, not ${JSON.stringify(value.slice(0, 60))}`);
}

function toBoolean(spec: InputSpec, value: AnswerValue): Coerced {
  if (typeof value === "boolean") return ok(value);
  if (value === "true") return ok(true);
  if (value === "false") return ok(false);
  return problem(spec, `must be true or false, not ${JSON.stringify(value.slice(0, 60))}`);
}

/** https only, no credentials. The normalised form is what gets stored. */
function toUrl(spec: InputSpec, value: AnswerValue): Coerced {
  if (typeof value !== "string" || value.length > MAX_TEXT) return problem(spec, "must be an https URL of at most 200 characters");
  const url = parseUrl(value);
  if (url === undefined || url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    return problem(spec, `must be an https URL without credentials, not ${JSON.stringify(value.slice(0, 60))}`);
  }
  return ok(url.href);
}

function isPackage(candidate: string): boolean {
  return (
    candidate.length <= MAX_PACKAGE &&
    PACKAGE.test(candidate) &&
    candidate.split(".").every((segment) => !JAVA_RESERVED.has(segment))
  );
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function ok(value: AnswerValue): Coerced {
  return { ok: true, value };
}

function problem(spec: InputSpec, message: string): Coerced {
  return { ok: false, problem: `Input ${JSON.stringify(spec.key)} (${spec.label}) ${message}.` };
}
