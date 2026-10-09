import { EmdError } from "../errors.js";

export type JsonRecord = Record<string, unknown>;

/**
 * Upstream version strings only ever contain letters, digits and . _ + - so anything else is not a
 * version. Every version that came from the network passes this before it is used, printed or
 * written into a generated build file.
 */
const VERSION_TOKEN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expectRecord(value: unknown, what: string): JsonRecord {
  if (!isRecord(value)) throw badResponse(what, "an object");
  return value;
}

export function expectArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw badResponse(what, "an array");
  return value;
}

export function expectString(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) throw badResponse(what, "a non-empty string");
  return value;
}

export function isVersionToken(value: string): boolean {
  return VERSION_TOKEN.test(value);
}

export function expectVersion(value: unknown, what: string): string {
  const text = expectString(value, what);
  if (!isVersionToken(text)) throw badResponse(what, "a plain version string");
  return text;
}

export function parseJsonText(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new EmdError("BAD_RESPONSE", `Unexpected response: ${what} is not valid JSON.`, { cause });
  }
}

function badResponse(what: string, expected: string): EmdError {
  return new EmdError("BAD_RESPONSE", `Unexpected response: ${what} should be ${expected}.`);
}
