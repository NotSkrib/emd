import { describe, expect, it } from "vitest";
import type { Agent, Command, Skill } from "../../src/install/content.js";
import { emitAgent, emitCommand, emitSkillFiles, managedVersion } from "../../src/install/emit.js";
import { parseFrontmatter } from "../../src/install/frontmatter.js";
import { errorCodeOf } from "../helpers/fixtures.js";

const agent = (overrides: Partial<Agent> = {}): Agent => ({
  name: "emd-reviewer",
  description: 'Reviews "stale" Minecraft code.',
  readonly: false,
  body: "You review code.\n\nBe brief.\n",
  ...overrides,
});

const VERSION = "1.2.3";

describe("emitAgent claude-md", () => {
  it("writes a Claude-format file that Claude Code, VS Code and Cursor can all read", () => {
    const { fileName, content } = emitAgent(agent(), "claude-md", VERSION);

    expect(fileName).toBe("emd-reviewer.md");
    expect(content).toBe(
      '---\nname: "emd-reviewer"\ndescription: "Reviews \\"stale\\" Minecraft code."\n---\nYou review code.\n\nBe brief.\n\n<!-- emd-managed 1.2.3 -->\n',
    );
  });

  it("marks a read-only agent for Cursor and denies Claude's editing tools", () => {
    const { content } = emitAgent(agent({ readonly: true }), "claude-md", VERSION);
    const { fields } = parseFrontmatter(content);

    expect(fields).toMatchObject({ readonly: true, disallowedTools: "Write, Edit, NotebookEdit" });
  });
});

describe("emitAgent opencode-md", () => {
  it("writes no name and no marker in the header, because OpenCode passes unknown keys on to the model", () => {
    const { fileName, content } = emitAgent(agent(), "opencode-md", VERSION);

    expect(fileName).toBe("emd-reviewer.md");
    expect(content).toBe(
      '---\ndescription: "Reviews \\"stale\\" Minecraft code."\nmode: subagent\n---\nYou review code.\n\nBe brief.\n\n<!-- emd-managed 1.2.3 -->\n',
    );
  });

  it("denies editing for a read-only agent through OpenCode's permission block", () => {
    const { content } = emitAgent(agent({ readonly: true }), "opencode-md", VERSION);

    expect(content).toContain("mode: subagent\npermission:\n  edit: deny\n---\n");
  });
});

describe("emitAgent gemini-md", () => {
  it("writes the name and description and lets the agent inherit the parent's tools", () => {
    const { fileName, content } = emitAgent(agent({ readonly: true }), "gemini-md", VERSION);

    expect(fileName).toBe("emd-reviewer.md");
    expect(content).toBe(
      '---\nname: "emd-reviewer"\ndescription: "Reviews \\"stale\\" Minecraft code."\n---\nYou review code.\n\nBe brief.\n\n<!-- emd-managed 1.2.3 -->\n',
    );
  });
});

describe("emitAgent codex-toml", () => {
  it("writes the three required fields, with the instructions as a literal multi-line string", () => {
    const { fileName, content } = emitAgent(agent(), "codex-toml", VERSION);

    expect(fileName).toBe("emd-reviewer.toml");
    expect(content).toBe(
      "name = \"emd-reviewer\"\ndescription = \"Reviews \\\"stale\\\" Minecraft code.\"\ndeveloper_instructions = '''\nYou review code.\n\nBe brief.\n'''\n\n# emd-managed 1.2.3\n",
    );
  });

  it("keeps backslashes in the instructions as they are", () => {
    const { content } = emitAgent(agent({ body: "Use C:\\path and \\n literally.\n" }), "codex-toml", VERSION);

    expect(content).toContain("Use C:\\path and \\n literally.");
  });

  it("refuses instructions that would end the string early", () => {
    expect(errorCodeOf(() => emitAgent(agent({ body: "bad ''' here\n" }), "codex-toml", VERSION))).toBe("BAD_CONTENT");
  });

  it("refuses control characters that TOML does not allow in a string", () => {
    expect(errorCodeOf(() => emitAgent(agent({ body: "bad \u0007 bell\n" }), "codex-toml", VERSION))).toBe("BAD_CONTENT");
  });
});

const command = (overrides: Partial<Command> = {}): Command => ({
  name: "new",
  description: 'Creates a "Minecraft" project.',
  argumentHint: "[what to build]",
  body: "Build this: $ARGUMENTS\n\nThen use /emd:plan and /emd:review.\n",
  ...overrides,
});

describe("emitCommand gemini-toml", () => {
  it("puts the command in the emd namespace folder, so Gemini CLI calls it /emd:new", () => {
    const { relativePath, content } = emitCommand(command(), "gemini-toml", VERSION);

    expect(relativePath).toBe("emd/new.toml");
    expect(content).toBe(
      "description = \"Creates a \\\"Minecraft\\\" project.\"\nprompt = '''\nBuild this: {{args}}\n\nThen use /emd:plan and /emd:review.\n'''\n\n# emd-managed 1.2.3\n",
    );
  });

  it("replaces every $ARGUMENTS with Gemini's {{args}}", () => {
    const { content } = emitCommand(command({ body: "$ARGUMENTS and again $ARGUMENTS\n" }), "gemini-toml", VERSION);

    expect(content).toContain("{{args}} and again {{args}}");
    expect(content).not.toContain("$ARGUMENTS");
  });

  it.each([
    ["a literal string terminator", "bad ''' here $ARGUMENTS\n"],
    ["a control character", "bad \u0007 bell $ARGUMENTS\n"],
    ["a shell injection", "run !{rm -rf x} $ARGUMENTS\n"],
    ["a file injection", "read @{secrets.txt} $ARGUMENTS\n"],
    ["a placeholder of its own", "hello {{args}} $ARGUMENTS\n"],
  ])("refuses a body with %s, because Gemini CLI would act on it", (_label, body) => {
    expect(errorCodeOf(() => emitCommand(command({ body }), "gemini-toml", VERSION))).toBe("BAD_CONTENT");
  });
});

describe("emitCommand opencode-md", () => {
  it("names the file after the command with the emd- prefix, because OpenCode names a command after its file", () => {
    const { relativePath, content } = emitCommand(command(), "opencode-md", VERSION);

    expect(relativePath).toBe("emd-new.md");
    expect(content).toBe(
      '---\ndescription: "Creates a \\"Minecraft\\" project."\n---\nBuild this: $ARGUMENTS\n\nThen use /emd-plan and /emd-review.\n\n<!-- emd-managed 1.2.3 -->\n',
    );
  });

  it("writes no header key but the description, because OpenCode may pass unknown ones to the model", () => {
    const { fields } = parseFrontmatter(emitCommand(command(), "opencode-md", VERSION).content);

    expect(Object.keys(fields)).toEqual(["description"]);
  });

  it.each([
    ["a shell injection", "run !`rm -rf x` $ARGUMENTS\n"],
    ["a file reference", "read @src/secret.txt $ARGUMENTS\n"],
  ])("refuses a body with %s, because OpenCode would act on it", (_label, body) => {
    expect(errorCodeOf(() => emitCommand(command({ body }), "opencode-md", VERSION))).toBe("BAD_CONTENT");
  });

  it("accepts an at sign inside a word, such as an address", () => {
    expect(() => emitCommand(command({ body: "mail me@example.com $ARGUMENTS\n" }), "opencode-md", VERSION)).not.toThrow();
  });
});

describe("emitSkillFiles", () => {
  const skill: Skill = {
    name: "emd-test",
    description: "A test.",
    files: [
      { path: "SKILL.md", content: '---\nname: emd-test\ndescription: "A test."\n---\n# Test\n' },
      { path: "references/FACTS.md", content: "# Facts\n" },
    ],
  };

  it("marks SKILL.md as managed and leaves the other files exactly as they are", () => {
    const files = emitSkillFiles(skill, VERSION);

    expect(files.find((file) => file.path === "SKILL.md")?.content).toBe(
      '---\nname: emd-test\ndescription: "A test."\n---\n# Test\n\n<!-- emd-managed 1.2.3 -->\n',
    );
    expect(files.find((file) => file.path === "references/FACTS.md")?.content).toBe("# Facts\n");
  });

  it("adds the marker to a SKILL.md that has no final newline", () => {
    const [main] = emitSkillFiles({ ...skill, files: [{ path: "SKILL.md", content: "---\nname: emd-test\ndescription: x\n---\nBody" }] }, VERSION);

    expect(main?.content).toBe("---\nname: emd-test\ndescription: x\n---\nBody\n\n<!-- emd-managed 1.2.3 -->\n");
  });
});

describe("managedVersion", () => {
  it("reads the version from a Markdown or TOML marker", () => {
    expect(managedVersion("text\n\n<!-- emd-managed 0.4.1 -->\n")).toBe("0.4.1");
    expect(managedVersion("x = 1\n\n# emd-managed 0.4.1\n")).toBe("0.4.1");
    expect(managedVersion("text\r\n\r\n<!-- emd-managed 0.4.1 -->\r\n")).toBe("0.4.1");
  });

  it("finds nothing in a file EMD did not write", () => {
    expect(managedVersion("# My own skill\n")).toBeUndefined();
    expect(managedVersion("mentions emd-managed 1.0 in a sentence\n")).toBeUndefined();
    expect(managedVersion("")).toBeUndefined();
  });

  it("recognises what the emitters write", () => {
    expect(managedVersion(emitAgent(agent(), "claude-md", VERSION).content)).toBe(VERSION);
    expect(managedVersion(emitAgent(agent(), "codex-toml", VERSION).content)).toBe(VERSION);
    expect(managedVersion(emitCommand(command(), "gemini-toml", VERSION).content)).toBe(VERSION);
    expect(managedVersion(emitCommand(command(), "opencode-md", VERSION).content)).toBe(VERSION);
  });
});
