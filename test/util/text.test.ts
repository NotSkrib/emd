import { describe, expect, it } from "vitest";
import { hasControlCharacters, stripControlCharacters } from "../../src/util/text.js";

describe("stripControlCharacters", () => {
  it("keeps ordinary text, tabs and newlines", () => {
    expect(stripControlCharacters("Paper\t26.3\nFolia 26.2")).toBe("Paper\t26.3\nFolia 26.2");
  });

  it("removes escape sequences, bells and carriage returns", () => {
    expect(stripControlCharacters("a\u001b[2Kb\u0007c\rd")).toBe("a[2Kbcd");
  });

  it("removes the delete character and the C1 control range", () => {
    expect(stripControlCharacters("a\u007fb\u0085c\u009fd")).toBe("abcd");
  });

  it("removes Unicode line and paragraph separators", () => {
    expect(stripControlCharacters("a b c")).toBe("abc");
  });

  it("keeps non-ASCII text", () => {
    expect(stripControlCharacters("é日本語🙂")).toBe("é日本語🙂");
  });

  it("returns an empty string unchanged", () => {
    expect(stripControlCharacters("")).toBe("");
  });
});

describe("hasControlCharacters", () => {
  it.each(["a\tb", "a\nb", "a\rb", "a\u001bb", "a\u007fb", "a\u0085b", "a b", "a b"])("detects %j", (text) => {
    expect(hasControlCharacters(text)).toBe(true);
  });

  it.each(["", "plain text", "é日本語🙂", "quotes \" and ' and \\"])("accepts %j", (text) => {
    expect(hasControlCharacters(text)).toBe(false);
  });
});
