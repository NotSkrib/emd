import { describe, expect, it } from "vitest";
import { checkPackMcmeta } from "../../src/presets/packCheck.js";

const valid = (pack: Record<string, unknown> = {}): unknown => ({
  pack: { description: "A pack.", min_format: [121, 0], max_format: 121, ...pack },
});

describe("checkPackMcmeta", () => {
  it("accepts the format Minecraft 1.21.9 and newer expect", () => {
    expect(checkPackMcmeta(valid())).toEqual([]);
  });

  it.each([
    ["integers", { min_format: 88, max_format: 88 }],
    ["one-element lists", { min_format: [88], max_format: [88] }],
    ["a minor version on both ends", { min_format: [107, 1], max_format: [107, 5] }],
    ["a text component description", { description: { text: "A pack.", color: "gold" } }],
    ["a list description", { description: [{ text: "A " }, "pack."] }],
  ])("accepts %s", (_label, pack) => {
    expect(checkPackMcmeta(valid(pack))).toEqual([]);
  });

  it("rejects the old single pack_format on its own", () => {
    const problems = checkPackMcmeta({ pack: { description: "x", pack_format: 48 } });

    expect(problems.join("\n")).toMatch(/min_format/);
    expect(problems.join("\n")).toMatch(/pack_format/);
  });

  it("rejects pack_format and supported_formats next to the new fields", () => {
    expect(checkPackMcmeta(valid({ pack_format: 94 })).join("\n")).toMatch(/pack_format/);
    expect(checkPackMcmeta(valid({ supported_formats: [94, 121] })).join("\n")).toMatch(/supported_formats/);
  });

  it("rejects a missing or empty description", () => {
    expect(checkPackMcmeta(valid({ description: undefined })).join("\n")).toMatch(/description/);
    expect(checkPackMcmeta(valid({ description: "" })).join("\n")).toMatch(/description/);
    expect(checkPackMcmeta(valid({ description: 5 })).join("\n")).toMatch(/description/);
  });

  it("rejects a missing min_format or max_format", () => {
    expect(checkPackMcmeta(valid({ min_format: undefined })).join("\n")).toMatch(/min_format/);
    expect(checkPackMcmeta(valid({ max_format: undefined })).join("\n")).toMatch(/max_format/);
  });

  it.each([[[]], [[1, 2, 3]], [["88"]], [[-1]], [[1.5]], ["88"], [null], [true]])("rejects the format %j", (format) => {
    expect(checkPackMcmeta(valid({ min_format: format })).join("\n")).toMatch(/min_format/);
    expect(checkPackMcmeta(valid({ max_format: format })).join("\n")).toMatch(/max_format/);
  });

  it("rejects a minimum above the maximum", () => {
    expect(checkPackMcmeta(valid({ min_format: [122, 0], max_format: 121 })).join("\n")).toMatch(/above/);
    expect(checkPackMcmeta(valid({ min_format: [107, 2], max_format: [107, 1] })).join("\n")).toMatch(/above/);
  });

  it("accepts a minimum equal to a maximum that names no minor version", () => {
    expect(checkPackMcmeta(valid({ min_format: [107, 9], max_format: 107 }))).toEqual([]);
  });

  it.each([null, "text", 7, [], {}, { pack: null }, { pack: [] }])("rejects a file that is %j", (value) => {
    expect(checkPackMcmeta(value).length).toBeGreaterThan(0);
  });
});
