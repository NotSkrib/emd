import { describe, expect, it } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../src/install/frontmatter.js";
import { errorCodeOf } from "../helpers/fixtures.js";

describe("parseFrontmatter", () => {
  it("reads plain, quoted and boolean fields and keeps the body", () => {
    const parsed = parseFrontmatter('---\nname: emd-test\ndescription: "Say \\"hi\\": it works"\nreadonly: true\nother: false\n---\n# Body\n\ntext\n');

    expect(parsed.fields).toEqual({ name: "emd-test", description: 'Say "hi": it works', readonly: true, other: false });
    expect(parsed.body).toBe("# Body\n\ntext\n");
  });

  it("accepts Windows line endings", () => {
    const parsed = parseFrontmatter("---\r\nname: a\r\ndescription: b\r\n---\r\nBody\r\n");

    expect(parsed.fields).toEqual({ name: "a", description: "b" });
    expect(parsed.body).toBe("Body\r\n");
  });

  it("accepts single quotes and an empty body", () => {
    const parsed = parseFrontmatter("---\nname: 'a b'\n---\n");

    expect(parsed.fields).toEqual({ name: "a b" });
    expect(parsed.body).toBe("");
  });

  it("keeps a colon inside a plain value", () => {
    expect(parseFrontmatter("---\ndescription: Use when: building\n---\nx").fields.description).toBe("Use when: building");
  });

  it.each([
    ["no opening fence", "name: a\n---\nbody"],
    ["no closing fence", "---\nname: a\nbody"],
    ["a nested map", "---\nmetadata:\n  author: me\n---\nbody"],
    ["a list", "---\ntools:\n  - a\n---\nbody"],
    ["an inline list", "---\ntools: [a, b]\n---\nbody"],
    ["a block scalar", "---\ndescription: >\n  text\n---\nbody"],
    ["a duplicate key", "---\nname: a\nname: b\n---\nbody"],
    ["a line without a colon", "---\nname a\n---\nbody"],
    ["an invalid key", "---\nna me: a\n---\nbody"],
    ["an empty value", "---\nname:\n---\nbody"],
    ["an unterminated quote", '---\nname: "a\n---\nbody'],
    ["a leading comment", "# hi\n---\nname: a\n---\nbody"],
  ])("rejects %s", (_label, text) => {
    expect(errorCodeOf(() => parseFrontmatter(text))).toBe("BAD_CONTENT");
  });
});

describe("serializeFrontmatter", () => {
  it("writes strings as double-quoted YAML and booleans bare", () => {
    expect(serializeFrontmatter([["name", "emd-test"], ["description", 'Say "hi"\\ there'], ["readonly", true]])).toBe(
      '---\nname: "emd-test"\ndescription: "Say \\"hi\\"\\\\ there"\nreadonly: true\n---\n',
    );
  });

  it("round-trips through the parser", () => {
    const fields: Array<[string, string | boolean]> = [["name", "a"], ["description", "Use: when #1 'x' \"y\" é"], ["readonly", false]];
    const parsed = parseFrontmatter(`${serializeFrontmatter(fields)}body\n`);

    expect(parsed.fields).toEqual(Object.fromEntries(fields));
    expect(parsed.body).toBe("body\n");
  });

  it("refuses a value with a line break, which would break out of the header", () => {
    expect(errorCodeOf(() => serializeFrontmatter([["description", "a\n---\nevil: true"]]))).toBe("BAD_CONTENT");
  });

  it("refuses an invalid key", () => {
    expect(errorCodeOf(() => serializeFrontmatter([["na me", "a"]]))).toBe("BAD_CONTENT");
  });
});
