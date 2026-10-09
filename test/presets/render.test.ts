import { describe, expect, it } from "vitest";
import { renderTemplate } from "../../src/presets/render.js";
import type { RenderContext } from "../../src/presets/types.js";
import { errorCodeOf } from "../helpers/fixtures.js";

function context(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    input: { name: "MyPlugin", description: "a plain description", folia: true },
    derived: { packagePath: "dev/example" },
    resolved: { java: "25", paperApi: "26.3.build.+" },
    needsFilter: new Set(["input.description"]),
    ...overrides,
  };
}

const withDescription = (description: string): RenderContext => context({ input: { name: "MyPlugin", description } });

describe("renderTemplate substitution", () => {
  it("fills tokens from the input, derived and resolved namespaces", () => {
    expect(renderTemplate("{{input.name}} {{derived.packagePath}} {{resolved.java}}", context())).toBe("MyPlugin dev/example 25");
  });

  it("allows whitespace inside a token", () => {
    expect(renderTemplate("{{ input.name }}|{{ input.description | json }}", context())).toBe("MyPlugin|a plain description");
  });

  it("renders booleans as true or false", () => {
    expect(renderTemplate("folia={{input.folia}}", context())).toBe("folia=true");
  });

  it("leaves text without tokens untouched, including single braces and shell-style variables", () => {
    const text = '{ "a": {1} }\nvalue=${HOME}\n';
    expect(renderTemplate(text, context())).toBe(text);
  });

  it("keeps line structure", () => {
    expect(renderTemplate("a {{input.name}}\nb {{resolved.java}}\n", context())).toBe("a MyPlugin\nb 25\n");
  });

  it("does not expand tokens inside a substituted value", () => {
    const tricky = context({ input: { name: "{{resolved.java}}", description: "" } });
    expect(renderTemplate("{{input.name}}", tricky)).toBe("{{resolved.java}}");
  });

  it("treats a brace directly before a token as literal text", () => {
    expect(renderTemplate("{{{input.name}}}", context())).toBe("{MyPlugin}");
  });

  it("turns an escaped brace pair into a literal one", () => {
    expect(renderTemplate("run: echo $\\{{ matrix.os }}", context())).toBe("run: echo ${{ matrix.os }}");
  });
});

describe("renderTemplate escaping filters", () => {
  const description = 'say "hi" \\ $x';

  it.each([
    ["json", 'say \\"hi\\" \\\\ $x'],
    ["kotlin", 'say \\"hi\\" \\\\ \\$x'],
    ["java", 'say \\"hi\\" \\\\ $x'],
    ["yaml", 'say \\"hi\\" \\\\ $x'],
  ])("escapes for %s string literals", (filter, expected) => {
    expect(renderTemplate(`{{input.description|${filter}}}`, withDescription(description))).toBe(expected);
  });

  it("escapes XML special characters", () => {
    expect(renderTemplate("{{input.description|xml}}", withDescription(`a<b & "c" 'd'>`))).toBe(
      "a&lt;b &amp; &quot;c&quot; &apos;d&apos;&gt;",
    );
  });

  it("escapes backslashes and a leading space for .properties values", () => {
    expect(renderTemplate("{{input.description|properties}}", withDescription(" lead\\x"))).toBe("\\ lead\\\\x");
  });

  it("allows the raw filter on validated values", () => {
    expect(renderTemplate("{{input.name|raw}}", context())).toBe("MyPlugin");
  });
});

describe("renderTemplate rejections", () => {
  it("requires an escaping filter for free text", () => {
    expect(errorCodeOf(() => renderTemplate("{{input.description}}", context()))).toBe("BAD_TEMPLATE");
  });

  it("does not let the raw filter bypass that rule", () => {
    expect(errorCodeOf(() => renderTemplate("{{input.description|raw}}", context()))).toBe("BAD_TEMPLATE");
  });

  it("rejects an unknown filter", () => {
    expect(errorCodeOf(() => renderTemplate("{{input.name|shout}}", context()))).toBe("BAD_TEMPLATE");
  });

  it("rejects an unknown namespace", () => {
    expect(() => renderTemplate("{{env.HOME}}", context())).toThrow(/Unknown namespace/);
  });

  it("rejects a name with no value", () => {
    expect(() => renderTemplate("{{input.missing}}", context())).toThrow(/has no value/);
  });

  it("does not read inherited object properties", () => {
    expect(() => renderTemplate("{{input.constructor}}", context())).toThrow(/has no value/);
  });

  it.each(["{{input.name", "{{ nope }}", "{{input.name|}}", "{{input.__proto__}}"])(
    "rejects the malformed token in %j",
    (template) => {
      expect(errorCodeOf(() => renderTemplate(template, context()))).toBe("BAD_TEMPLATE");
    },
  );
});
