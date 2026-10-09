const TAB = 0x09;
const NEWLINE = 0x0a;
const LAST_C0_CONTROL = 0x1f;
const DELETE = 0x7f;
const LAST_C1_CONTROL = 0x9f;
const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;

/**
 * Removes control characters (everything except tab and newline) so upstream text cannot move the
 * cursor, rewrite earlier output or forge extra lines. It compares character codes instead of using
 * a regex, because the TypeScript emitter turns ` ` in a regex literal into a raw line
 * separator, which breaks the compiled file.
 */
export function stripControlCharacters(text: string): string {
  return Array.from(text)
    .filter((character) => !isUnsafe(character.codePointAt(0) ?? 0))
    .join("");
}

/** True when the text holds any control character, tab and newline included. Used to vet single-line input. */
export function hasControlCharacters(text: string): boolean {
  return Array.from(text).some((character) => isControl(character.codePointAt(0) ?? 0));
}

function isUnsafe(code: number): boolean {
  return code !== TAB && code !== NEWLINE && isControl(code);
}

function isControl(code: number): boolean {
  return (
    code <= LAST_C0_CONTROL ||
    (code >= DELETE && code <= LAST_C1_CONTROL) ||
    code === LINE_SEPARATOR ||
    code === PARAGRAPH_SEPARATOR
  );
}
