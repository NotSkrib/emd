import { describe, expect, it } from "vitest";
import { validateAnswers } from "../../src/presets/answers.js";
import { parsePresetManifest } from "../../src/presets/schema.js";
import { errorCodeOf } from "../helpers/fixtures.js";

const MANIFEST = parsePresetManifest({
  schema: 1,
  id: "answers-fixture",
  title: "Answers fixture",
  kind: "archetype",
  family: "plugin",
  platforms: ["paper"],
  inputs: [
    { key: "name", type: "identifier", label: "Name" },
    { key: "package", type: "package", label: "Package" },
    { key: "version", type: "version", label: "Version", default: "0.1.0" },
    { key: "description", type: "text", label: "Description", default: "" },
    { key: "website", type: "url", label: "Website", optional: true },
    { key: "folia", type: "boolean", label: "Folia", default: false },
    { key: "language", type: "choice", label: "Language", options: ["java", "kotlin"], default: "java" },
  ],
});

const VALID = { name: "MyPlugin", package: "dev.notskrib.my" };

describe("validateAnswers", () => {
  it("fills in defaults and leaves absent optional inputs out", () => {
    expect(validateAnswers(MANIFEST, VALID)).toEqual({
      name: "MyPlugin",
      package: "dev.notskrib.my",
      version: "0.1.0",
      description: "",
      folia: false,
      language: "java",
    });
  });

  it("keeps what the caller gave and converts text to the right type", () => {
    const answers = validateAnswers(MANIFEST, {
      ...VALID,
      version: "1.2.3",
      folia: "true",
      language: "kotlin",
      website: "https://example.com",
    });

    expect(answers).toMatchObject({ version: "1.2.3", folia: true, language: "kotlin", website: "https://example.com/" });
  });

  it("reports a missing required input", () => {
    expect(() => validateAnswers(MANIFEST, { name: "MyPlugin" })).toThrow(/"package".*is required/);
  });

  it("reports every problem at once", () => {
    const run = (): unknown => validateAnswers(MANIFEST, { name: "1bad", package: "Bad..Pkg", version: "x" });

    expect(errorCodeOf(run)).toBe("BAD_ANSWER");
    expect(() => run()).toThrow(/"name"[\s\S]*"package"[\s\S]*"version"/);
  });

  it("rejects an answer the preset does not ask for, including inherited property names", () => {
    expect(() => validateAnswers(MANIFEST, { ...VALID, extra: "x", constructor: "y" })).toThrow(
      /Unknown input "extra"[\s\S]*Unknown input "constructor"/,
    );
  });
});

describe("validateAnswers slug inputs", () => {
  const slugManifest = parsePresetManifest({
    schema: 1,
    id: "slug-fixture",
    title: "Slug fixture",
    kind: "feature",
    family: "mod",
    platforms: ["fabric"],
    inputs: [{ key: "modId", type: "slug", label: "Mod id" }],
  });

  it.each(["my_mod", "ab", "mod2", "a".repeat(64)])("accepts the mod id %j", (modId) => {
    expect(validateAnswers(slugManifest, { modId })).toEqual({ modId });
  });

  it.each(["", "a", "My_Mod", "my-mod", "1mod", "_mod", "my mod", "my.mod", "a".repeat(65), "mod\n"])(
    "rejects the mod id %j",
    (modId) => {
      expect(errorCodeOf(() => validateAnswers(slugManifest, { modId }))).toBe("BAD_ANSWER");
    },
  );
});

describe("validateAnswers by input type", () => {
  const rejected = (input: Record<string, string | boolean>): string | undefined =>
    errorCodeOf(() => validateAnswers(MANIFEST, { ...VALID, ...input }));

  it.each(["my-plugin", "1plugin", "class", "", "has space", "x".repeat(33)])("rejects the plugin name %j", (name) => {
    expect(rejected({ name })).toBe("BAD_ANSWER");
  });

  it.each(["Dev.Example", "dev..example", "dev.class.x", "dev.example;rm", "1dev.example", ""])("rejects the package %j", (value) => {
    expect(rejected({ package: value })).toBe("BAD_ANSWER");
  });

  it.each(["1.0", "v1.0.0", "1.0.0\n", "1.0.0 beta", "1.0.0-"])("rejects the version %j", (version) => {
    expect(rejected({ version })).toBe("BAD_ANSWER");
  });

  it.each(["1.0.0", "1.0.0-beta.1", "26.3.0"])("accepts the version %j", (version) => {
    expect(rejected({ version })).toBeUndefined();
  });

  it("rejects multi-line and over-long text and accepts quotes and unicode", () => {
    expect(rejected({ description: "line one\nline two" })).toBe("BAD_ANSWER");
    expect(rejected({ description: "x".repeat(201) })).toBe("BAD_ANSWER");
    expect(rejected({ description: 'It\'s "great" é日本語' })).toBeUndefined();
  });

  it.each(["http://example.com", "https://user:pw@example.com", "not a url", "javascript:alert(1)", `https://${"a".repeat(200)}.com`])(
    "rejects the website %j",
    (website) => {
      expect(rejected({ website })).toBe("BAD_ANSWER");
    },
  );

  it.each([
    ["yes", true],
    ["1", true],
  ])("rejects the boolean %j", (value) => {
    expect(rejected({ folia: String(value) })).toBe("BAD_ANSWER");
  });

  it("accepts real booleans and the words true and false", () => {
    expect(validateAnswers(MANIFEST, { ...VALID, folia: true }).folia).toBe(true);
    expect(validateAnswers(MANIFEST, { ...VALID, folia: "false" }).folia).toBe(false);
  });

  it("rejects a choice that is not one of the options", () => {
    expect(rejected({ language: "scala" })).toBe("BAD_ANSWER");
  });

  it("rejects text where a boolean is expected and a boolean where text is expected", () => {
    expect(rejected({ folia: "maybe" })).toBe("BAD_ANSWER");
    expect(rejected({ name: true })).toBe("BAD_ANSWER");
  });
});
