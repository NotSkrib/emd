import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Content } from "../../src/install/content.js";
import { planInstall } from "../../src/install/plan.js";

const CONTENT: Content = {
  skills: [
    {
      name: "emd-one",
      description: "One.",
      files: [
        { path: "SKILL.md", content: '---\nname: emd-one\ndescription: "One."\n---\nBody\n' },
        { path: "references/FACTS.md", content: "# Facts\n" },
      ],
    },
  ],
  agents: [{ name: "emd-agent", description: "An agent.", readonly: true, body: "Do it.\n" }],
  commands: [],
};

const WITH_COMMANDS: Content = {
  ...CONTENT,
  commands: [{ name: "new", description: "Makes one.", argumentHint: "[what]", body: "Make it: $ARGUMENTS\nThen /emd:plan.\n" }],
};

const ROOT = path.resolve("/work/project");
const at = (...parts: string[]): string => path.join(ROOT, ...parts);

describe("planInstall", () => {
  it("plans one skill folder and one agent file per selected tool group", () => {
    const plan = planInstall(CONTENT, { tools: ["claude", "codex"], scope: "project", root: ROOT, version: "1.0.0" });

    expect(plan.units.map((unit) => [unit.kind, unit.name, unit.location])).toEqual([
      ["skill", "emd-one", at(".claude", "skills", "emd-one")],
      ["skill", "emd-one", at(".agents", "skills", "emd-one")],
      ["agent", "emd-agent", at(".claude", "agents", "emd-agent.md")],
      ["agent", "emd-agent", at(".codex", "agents", "emd-agent.toml")],
    ]);
  });

  it("gives each skill unit every file with the marker on SKILL.md", () => {
    const plan = planInstall(CONTENT, { tools: ["codex"], scope: "project", root: ROOT, version: "1.0.0" });
    const skill = plan.units.find((unit) => unit.kind === "skill");

    expect(skill?.files.map((file) => file.path)).toEqual([at(".agents", "skills", "emd-one", "SKILL.md"), at(".agents", "skills", "emd-one", "references", "FACTS.md")]);
    expect(skill?.files[0]?.content).toContain("<!-- emd-managed 1.0.0 -->");
    expect(skill?.files[1]?.content).toBe("# Facts\n");
  });

  it("writes the agent in the format of its folder", () => {
    const plan = planInstall(CONTENT, { tools: ["opencode"], scope: "project", root: ROOT, version: "1.0.0" });
    const agent = plan.units.find((unit) => unit.kind === "agent");

    expect(agent?.files[0]?.path).toBe(at(".opencode", "agents", "emd-agent.md"));
    expect(agent?.files[0]?.content).toContain("mode: subagent");
  });

  it("uses the root it was given, which is the home folder in user scope", () => {
    const home = path.resolve("/home/someone");
    const plan = planInstall(CONTENT, { tools: ["opencode"], scope: "user", root: home, version: "1.0.0" });

    expect(plan.units.map((unit) => unit.location)).toEqual([
      path.join(home, ".agents", "skills", "emd-one"),
      path.join(home, ".config", "opencode", "agents", "emd-agent.md"),
    ]);
  });

  it("reports what a tool cannot get instead of dropping it silently", () => {
    const plan = planInstall(CONTENT, { tools: ["antigravity"], scope: "project", root: ROOT, version: "1.0.0" });

    expect(plan.units.map((unit) => unit.kind)).toEqual(["skill"]);
    expect(plan.notes.join("\n")).toMatch(/Antigravity.*subagent/s);
  });

  it("plans nothing, and says so, when no selected tool can take anything", () => {
    const plan = planInstall(CONTENT, { tools: ["antigravity"], scope: "user", root: ROOT, version: "1.0.0" });

    expect(plan.units).toEqual([]);
    expect(plan.notes.join("\n")).toMatch(/differs by product/);
  });

  it("warns that tools reading two chosen folders may list each skill twice", () => {
    const plan = planInstall(CONTENT, { tools: ["claude", "codex", "opencode"], scope: "project", root: ROOT, version: "1.0.0" });

    expect(plan.notes.join("\n")).toMatch(/OpenCode.*twice/s);
    expect(planInstall(CONTENT, { tools: ["claude", "codex"], scope: "project", root: ROOT, version: "1.0.0" }).notes).toEqual([]);
  });

  it("plans a command file for each tool that has command files, in that tool's format", () => {
    const plan = planInstall(WITH_COMMANDS, { tools: ["gemini", "opencode"], scope: "project", root: ROOT, version: "1.0.0" });
    const commands = plan.units.filter((unit) => unit.kind === "command");

    expect(commands.map((unit) => [unit.name, unit.location])).toEqual([
      ["new", at(".gemini", "commands", "emd", "new.toml")],
      ["new", at(".opencode", "commands", "emd-new.md")],
    ]);
    expect(commands[0]?.files[0]?.content).toContain("Make it: {{args}}");
    expect(commands[1]?.files[0]?.content).toContain("Then /emd-plan.");
  });

  it("plans no command for a tool that runs skills as commands, and says where to find them", () => {
    const plan = planInstall(WITH_COMMANDS, { tools: ["claude", "cursor"], scope: "project", root: ROOT, version: "1.0.0" });

    expect(plan.units.some((unit) => unit.kind === "command")).toBe(false);
    expect(plan.notes.join("\n")).toMatch(/Claude Code.*plugin install emd@emd/s);
    expect(plan.notes.join("\n")).toMatch(/Cursor.*skill/s);
  });

  it("stays quiet about commands when there are none to install", () => {
    const plan = planInstall(CONTENT, { tools: ["claude", "cursor"], scope: "project", root: ROOT, version: "1.0.0" });

    expect(plan.notes.join("\n")).not.toMatch(/plugin install/);
  });

  it("lists the tools each folder serves, for the summary", () => {
    const plan = planInstall(CONTENT, { tools: ["opencode", "claude"], scope: "project", root: ROOT, version: "1.0.0" });

    expect(plan.serves.get(at(".claude", "skills"))).toEqual(["claude", "opencode"]);
  });
});
