import { mkdir, mkdtemp, readdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findManaged, installPlan, removeManaged } from "../../src/install/apply.js";
import type { Content } from "../../src/install/content.js";
import { planInstall, type InstallPlan } from "../../src/install/plan.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "emd-apply-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const content = (extraFile = false): Content => ({
  skills: [
    {
      name: "emd-one",
      description: "One.",
      files: [
        { path: "SKILL.md", content: '---\nname: emd-one\ndescription: "One."\n---\nBody\n' },
        ...(extraFile ? [{ path: "references/EXTRA.md", content: "# Extra\n" }] : []),
      ],
    },
  ],
  agents: [{ name: "emd-agent", description: "An agent.", readonly: false, body: "Do it.\n" }],
  commands: [],
});

const plan = (version = "1.0.0", extraFile = false): InstallPlan =>
  planInstall(content(extraFile), { tools: ["claude", "codex"], scope: "project", root, version });

const withCommand = (): Content => ({ ...content(), commands: [{ name: "new", description: "Makes one.", argumentHint: "[what]", body: "Make it: $ARGUMENTS\n" }] });
const commandPlan = (version = "1.0.0"): InstallPlan => planInstall(withCommand(), { tools: ["gemini", "opencode"], scope: "project", root, version });

const at = (...parts: string[]): string => path.join(root, ...parts);
const read = (...parts: string[]): Promise<string> => readFile(at(...parts), "utf8");
const exists = (...parts: string[]): Promise<boolean> => readFile(at(...parts)).then(() => true, () => false);

async function put(relative: string, text: string): Promise<void> {
  await mkdir(path.dirname(at(relative)), { recursive: true });
  await writeFile(at(relative), text);
}

describe("installPlan", () => {
  it("creates every skill folder and agent file", async () => {
    const outcomes = await installPlan(plan(), { dryRun: false });

    expect(outcomes.map((outcome) => outcome.action)).toEqual(["create", "create", "create", "create"]);
    expect(await read(".claude", "skills", "emd-one", "SKILL.md")).toContain("<!-- emd-managed 1.0.0 -->");
    expect(await read(".agents", "skills", "emd-one", "SKILL.md")).toContain("emd-managed");
    expect(await read(".claude", "agents", "emd-agent.md")).toContain('name: "emd-agent"');
    expect(await read(".codex", "agents", "emd-agent.toml")).toContain("developer_instructions");
  });

  it("changes nothing on a dry run", async () => {
    const outcomes = await installPlan(plan(), { dryRun: true });

    expect(outcomes.every((outcome) => outcome.action === "create")).toBe(true);
    expect(await readdir(root)).toEqual([]);
  });

  it("reports unchanged on a second run", async () => {
    await installPlan(plan(), { dryRun: false });
    const outcomes = await installPlan(plan(), { dryRun: false });

    expect(outcomes.map((outcome) => outcome.action)).toEqual(["unchanged", "unchanged", "unchanged", "unchanged"]);
  });

  it("updates what it installed earlier, removes files it no longer ships, and tidies empty folders", async () => {
    await installPlan(plan("1.0.0", true), { dryRun: false });
    expect(await exists(".claude", "skills", "emd-one", "references", "EXTRA.md")).toBe(true);

    const outcomes = await installPlan(plan("2.0.0", false), { dryRun: false });

    expect(outcomes.map((outcome) => outcome.action)).toEqual(["update", "update", "update", "update"]);
    expect(await read(".claude", "skills", "emd-one", "SKILL.md")).toContain("emd-managed 2.0.0");
    expect(await exists(".claude", "skills", "emd-one", "references", "EXTRA.md")).toBe(false);
    expect(await readdir(at(".claude", "skills", "emd-one"))).toEqual(["SKILL.md"]);
  });

  it("refuses to touch a skill folder it did not install, and writes nothing at all", async () => {
    await put(".claude/skills/emd-one/SKILL.md", "---\nname: emd-one\ndescription: mine\n---\nmy own skill\n");

    expect(await errorCodeOfAsync(() => installPlan(plan(), { dryRun: false }))).toBe("CONFLICT");
    await expect(installPlan(plan(), { dryRun: false })).rejects.toThrow(/not installed by EMD/);
    expect(await exists(".agents", "skills", "emd-one", "SKILL.md")).toBe(false);
    expect(await exists(".codex", "agents", "emd-agent.toml")).toBe(false);
    expect(await read(".claude", "skills", "emd-one", "SKILL.md")).toContain("my own skill");
  });

  it("refuses a folder with an emd- name that holds other files and no SKILL.md", async () => {
    await put(".claude/skills/emd-one/notes.txt", "mine");

    await expect(installPlan(plan(), { dryRun: false })).rejects.toThrow(/not installed by EMD/);
    expect(await read(".claude", "skills", "emd-one", "notes.txt")).toBe("mine");
  });

  it("refuses an agent file it did not write", async () => {
    await put(".claude/agents/emd-agent.md", "---\nname: emd-agent\n---\nmine\n");

    await expect(installPlan(plan(), { dryRun: false })).rejects.toThrow(/not installed by EMD/);
    expect(await read(".claude", "agents", "emd-agent.md")).toContain("mine");
  });

  it("names every conflict in one error", async () => {
    await put(".claude/skills/emd-one/SKILL.md", "mine\n");
    await put(".codex/agents/emd-agent.toml", "mine\n");

    await expect(installPlan(plan(), { dryRun: true })).rejects.toThrow(/emd-one[\s\S]*emd-agent/);
  });

  it("refuses to write through a link where an agent file should be", async (context) => {
    await put("elsewhere.md", "keep me\n");
    await mkdir(at(".claude", "agents"), { recursive: true });
    const link = at(".claude", "agents", "emd-agent.md");
    try {
      await symlink(at("elsewhere.md"), link);
    } catch {
      context.skip(); // Creating links needs extra privileges on some systems.
    }

    try {
      await expect(installPlan(plan(), { dryRun: false })).rejects.toThrow(/link/);
      expect(await read("elsewhere.md")).toBe("keep me\n");
    } finally {
      await unlink(link);
    }
  });
});

describe("installPlan commands", () => {
  it("creates the command files, and the emd namespace folder Gemini CLI needs", async () => {
    const outcomes = await installPlan(commandPlan(), { dryRun: false });

    expect(outcomes.filter((outcome) => outcome.unit.kind === "command").map((outcome) => outcome.action)).toEqual(["create", "create"]);
    expect(await read(".gemini", "commands", "emd", "new.toml")).toContain("Make it: {{args}}");
    expect(await read(".opencode", "commands", "emd-new.md")).toContain("Make it: $ARGUMENTS");
  });

  it("updates a command it installed earlier and reports an unchanged one", async () => {
    await installPlan(commandPlan("1.0.0"), { dryRun: false });
    expect((await installPlan(commandPlan("1.0.0"), { dryRun: false })).filter((outcome) => outcome.unit.kind === "command").map((outcome) => outcome.action)).toEqual(["unchanged", "unchanged"]);

    await installPlan(commandPlan("2.0.0"), { dryRun: false });

    expect(await read(".gemini", "commands", "emd", "new.toml")).toContain("emd-managed 2.0.0");
  });

  it("refuses a command file it did not write, and writes nothing at all", async () => {
    await put(".gemini/commands/emd/new.toml", 'prompt = "mine"\n');

    await expect(installPlan(commandPlan(), { dryRun: false })).rejects.toThrow(/not installed by EMD/);
    expect(await read(".gemini", "commands", "emd", "new.toml")).toBe('prompt = "mine"\n');
    expect(await exists(".opencode", "commands", "emd-new.md")).toBe(false);
  });

  it("refuses to write through a linked emd namespace folder", async (context) => {
    await mkdir(at("elsewhere"), { recursive: true });
    await mkdir(at(".gemini", "commands"), { recursive: true });
    const link = at(".gemini", "commands", "emd");
    try {
      await symlink(at("elsewhere"), link, "dir");
    } catch {
      context.skip(); // Creating links needs extra privileges on some systems.
    }

    try {
      await expect(installPlan(commandPlan(), { dryRun: false })).rejects.toThrow(/link/);
      expect(await readdir(at("elsewhere"))).toEqual([]);
    } finally {
      await unlink(link);
    }
  });
});

describe("findManaged and removeManaged commands", () => {
  it("finds commands in the namespace folder and in the flat layout, and ignores files without the marker", async () => {
    await installPlan(commandPlan("1.2.3"), { dryRun: false });
    await put(".gemini/commands/emd/own.toml", 'prompt = "mine"\n');
    await put(".gemini/commands/mine.toml", 'prompt = "mine"\n');
    await put(".opencode/commands/emd-fake.md", "no marker\n");

    const found = await findManaged(root, "project", ["gemini", "opencode"]);

    expect(found.filter((item) => item.kind === "command").map((item) => [item.name, item.version]).sort()).toEqual([
      ["emd-new", "1.2.3"],
      ["emd:new", "1.2.3"],
    ]);
  });

  it("removes the commands and the namespace folder once it is empty", async () => {
    await installPlan(commandPlan(), { dryRun: false });

    await removeManaged(await findManaged(root, "project", ["gemini", "opencode"]));

    expect(await exists(".gemini", "commands", "emd", "new.toml")).toBe(false);
    expect(await exists(".opencode", "commands", "emd-new.md")).toBe(false);
    expect(await readdir(at(".gemini", "commands"))).toEqual([]);
  });

  it("keeps a namespace folder that still holds a file of the user's", async () => {
    await installPlan(commandPlan(), { dryRun: false });
    await put(".gemini/commands/emd/own.toml", 'prompt = "mine"\n');

    await removeManaged(await findManaged(root, "project", ["gemini"]));

    expect(await exists(".gemini", "commands", "emd", "new.toml")).toBe(false);
    expect(await read(".gemini", "commands", "emd", "own.toml")).toBe('prompt = "mine"\n');
  });
});

describe("findManaged and removeManaged", () => {
  it("finds what was installed, with its version, and nothing else", async () => {
    await installPlan(plan("1.2.3"), { dryRun: false });
    await put(".claude/skills/emd-own/SKILL.md", "---\nname: emd-own\ndescription: mine\n---\nnot installed by EMD\n");
    await put(".claude/skills/other/SKILL.md", "---\nname: other\ndescription: x\n---\nx\n");
    await put(".claude/agents/emd-fake.md", "no marker\n");

    const found = await findManaged(root, "project", ["claude", "codex"]);

    expect(found.map((item) => [item.kind, item.name, item.version]).sort()).toEqual([
      ["agent", "emd-agent", "1.2.3"],
      ["agent", "emd-agent", "1.2.3"],
      ["skill", "emd-one", "1.2.3"],
      ["skill", "emd-one", "1.2.3"],
    ]);
  });

  it("removes only managed items and leaves everything else alone", async () => {
    await installPlan(plan("1.0.0", true), { dryRun: false });
    await put(".claude/skills/emd-own/SKILL.md", "mine\n");
    await put(".claude/skills/other/SKILL.md", "other\n");

    const removed = await removeManaged(await findManaged(root, "project", ["claude", "codex"]));

    expect(removed).toHaveLength(4);
    expect(await exists(".claude", "skills", "emd-one", "SKILL.md")).toBe(false);
    expect(await exists(".claude", "agents", "emd-agent.md")).toBe(false);
    expect(await read(".claude", "skills", "emd-own", "SKILL.md")).toBe("mine\n");
    expect(await read(".claude", "skills", "other", "SKILL.md")).toBe("other\n");
  });

  it("finds nothing in a folder that does not exist", async () => {
    expect(await findManaged(root, "project", ["claude"])).toEqual([]);
  });
});
