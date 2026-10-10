import { describe, expect, it } from "vitest";
import {
  allAgentFolders,
  allCommandFolders,
  allSkillFolders,
  chooseAgentSinks,
  chooseCommandSinks,
  chooseSkillFolders,
  parseToolList,
  TOOL_IDS,
  type ToolId,
} from "../../src/install/tools.js";
import { errorCodeOf } from "../helpers/fixtures.js";

describe("parseToolList", () => {
  it("accepts one tool, a comma list, and all", () => {
    expect(parseToolList("claude")).toEqual(["claude"]);
    expect(parseToolList("codex,claude")).toEqual(["codex", "claude"]);
    expect(parseToolList("all")).toEqual([...TOOL_IDS]);
  });

  it("removes duplicates and ignores spaces", () => {
    expect(parseToolList("claude, codex ,claude")).toEqual(["claude", "codex"]);
  });

  it.each(["", "  ", "claude,", "nope", "claude,nope", "ALL", "all,claude"])("rejects %j with a usage error", (value) => {
    expect(errorCodeOf(() => parseToolList(value))).toBe("USAGE");
  });

  it("names the supported tools when one is unknown", () => {
    expect(() => parseToolList("vim")).toThrow(/claude.*opencode.*copilot.*codex.*cursor.*gemini.*antigravity/s);
  });
});

describe("chooseSkillFolders", () => {
  const folders = (tools: ToolId[], scope: "project" | "user" = "project") => chooseSkillFolders(tools, scope).folders;

  it("uses the shared .agents/skills folder for every tool that reads it", () => {
    expect(folders(["codex", "gemini", "cursor", "opencode", "copilot", "antigravity"])).toEqual([".agents/skills"]);
  });

  it("gives Claude Code its own folder, because it does not read .agents/skills", () => {
    expect(folders(["claude"])).toEqual([".claude/skills"]);
  });

  it("lets a tool that also reads .claude/skills share Claude's folder instead of adding a second copy", () => {
    expect(folders(["opencode", "claude"])).toEqual([".claude/skills"]);
    expect(folders(["claude", "cursor"])).toEqual([".claude/skills"]);
    expect(folders(["copilot", "claude"])).toEqual([".claude/skills"]);
  });

  it("uses two folders only when a selected tool can read just the other one", () => {
    expect(folders(["claude", "codex"])).toEqual([".claude/skills", ".agents/skills"]);
    expect(folders(["claude", "gemini"])).toEqual([".claude/skills", ".agents/skills"]);
  });

  it("does not depend on the order the tools were given", () => {
    expect(new Set(folders(["codex", "claude", "opencode"]))).toEqual(new Set(folders(["claude", "opencode", "codex"])));
  });

  it("reports which tools each folder serves", () => {
    const shared = chooseSkillFolders(["opencode", "claude"], "project").serves;
    expect(shared.get(".claude/skills")).toEqual(["claude", "opencode"]);

    const split = chooseSkillFolders(["claude", "codex"], "project").serves;
    expect(split.get(".claude/skills")).toEqual(["claude"]);
    expect(split.get(".agents/skills")).toEqual(["codex"]);
  });

  it("lists the tools that read more than one chosen folder, because they will see a skill twice", () => {
    expect(chooseSkillFolders(["claude", "codex", "opencode", "cursor"], "project").readsSeveral).toEqual(["opencode", "cursor"]);
    expect(chooseSkillFolders(["claude", "codex"], "project").readsSeveral).toEqual([]);
    expect(chooseSkillFolders(["claude", "opencode"], "project").readsSeveral).toEqual([]);
    expect(chooseSkillFolders(["codex", "gemini", "cursor"], "project").readsSeveral).toEqual([]);
  });

  it("uses the user-level folders in user scope", () => {
    expect(folders(["claude"], "user")).toEqual([".claude/skills"]);
    expect(folders(["codex", "gemini"], "user")).toEqual([".agents/skills"]);
  });

  it("says Antigravity has no reliable user-level folder, instead of guessing", () => {
    const result = chooseSkillFolders(["antigravity", "codex"], "user");

    expect(result.folders).toEqual([".agents/skills"]);
    expect(result.unsupported).toEqual([{ tool: "antigravity", reason: expect.stringMatching(/differs by product/) }]);
  });
});

describe("allSkillFolders and allAgentFolders", () => {
  it("list every folder the selected tools read, without repeats", () => {
    expect(allSkillFolders(["claude", "codex"], "project")).toEqual([".claude/skills", ".agents/skills"]);
    expect(allSkillFolders(["opencode", "claude"], "project")).toEqual([".agents/skills", ".claude/skills", ".opencode/skills"]);
    expect(allAgentFolders(["claude", "copilot", "cursor"], "project")).toEqual([".claude/agents", ".cursor/agents"]);
  });

  it("list nothing for a tool without that kind of folder", () => {
    expect(allSkillFolders(["antigravity"], "user")).toEqual([]);
    expect(allAgentFolders(["antigravity"], "project")).toEqual([]);
  });
});

describe("chooseAgentSinks", () => {
  const sinks = (tools: ToolId[], scope: "project" | "user" = "project") => chooseAgentSinks(tools, scope).sinks;

  it("shares one Claude-format folder between Claude Code, VS Code Copilot and Cursor", () => {
    expect(sinks(["claude", "copilot", "cursor"])).toEqual([{ format: "claude-md", folder: ".claude/agents" }]);
  });

  it("gives every other tool its own format and folder", () => {
    expect(sinks(["opencode", "gemini", "codex"])).toEqual([
      { format: "opencode-md", folder: ".opencode/agents" },
      { format: "gemini-md", folder: ".gemini/agents" },
      { format: "codex-toml", folder: ".codex/agents" },
    ]);
  });

  it("puts OpenCode's user-level agents in its own config folder", () => {
    expect(sinks(["opencode"], "user")).toEqual([{ format: "opencode-md", folder: ".config/opencode/agents" }]);
  });

  it("notes that Antigravity has no agent files", () => {
    const result = chooseAgentSinks(["antigravity", "claude"], "project");

    expect(result.sinks).toEqual([{ format: "claude-md", folder: ".claude/agents" }]);
    expect(result.unsupported).toEqual([{ tool: "antigravity", reason: expect.stringMatching(/subagent/i) }]);
  });
});

describe("chooseCommandSinks", () => {
  it("gives Gemini CLI a TOML folder and OpenCode its own Markdown folder", () => {
    expect(chooseCommandSinks(["gemini", "opencode"], "project").sinks).toEqual([
      { format: "gemini-toml", folder: ".gemini/commands" },
      { format: "opencode-md", folder: ".opencode/commands" },
    ]);
  });

  it("puts OpenCode's user-level commands in its own config folder", () => {
    expect(chooseCommandSinks(["opencode", "gemini"], "user").sinks).toEqual([
      { format: "opencode-md", folder: ".config/opencode/commands" },
      { format: "gemini-toml", folder: ".gemini/commands" },
    ]);
  });

  it("says where the other tools get their commands instead of dropping them silently", () => {
    const reasons = Object.fromEntries(chooseCommandSinks(["claude", "copilot", "cursor", "codex", "antigravity"], "project").unsupported.map((entry) => [entry.tool, entry.reason]));

    expect(reasons.claude).toMatch(/plugin install emd@emd/);
    expect(reasons.copilot).toMatch(/skill/i);
    expect(reasons.cursor).toMatch(/skill/i);
    expect(reasons.codex).toMatch(/\$/);
    expect(reasons.antigravity).toMatch(/no custom command files/i);
  });

  it("writes no command file for the tools that run skills as commands", () => {
    expect(chooseCommandSinks(["claude", "copilot", "cursor", "codex", "antigravity"], "project").sinks).toEqual([]);
  });
});

describe("allCommandFolders", () => {
  it("lists every folder the selected tools read commands from, without repeats", () => {
    expect(allCommandFolders(["gemini", "opencode", "claude"], "project")).toEqual([".gemini/commands", ".opencode/commands"]);
    expect(allCommandFolders(["opencode"], "user")).toEqual([".config/opencode/commands"]);
  });

  it("lists nothing for a tool without command files", () => {
    expect(allCommandFolders(["codex", "cursor"], "project")).toEqual([]);
  });
});
