import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall, runStatus, runUninstall, type InstallDeps } from "../../src/commands/install.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let base: string;
let deps: InstallDeps;

beforeEach(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), "emd-install-"));
  deps = { contentDir: path.join(base, "content"), cwd: path.join(base, "project"), home: path.join(base, "home"), version: "1.0.0" };
  await mkdir(deps.cwd, { recursive: true });
  await mkdir(deps.home, { recursive: true });
  await put(deps.contentDir, "skills/emd-one/SKILL.md", '---\nname: emd-one\ndescription: "One."\n---\nBody\n');
  await put(deps.contentDir, "agents/emd-agent.md", '---\nname: emd-agent\ndescription: "An agent."\n---\nDo it.\n');
  await put(deps.contentDir, "commands/new.md", '---\ndescription: "Makes one."\nargument-hint: "[what]"\n---\nMake it: $ARGUMENTS\n');
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

async function put(root: string, relative: string, text: string): Promise<void> {
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

const exists = (...parts: string[]): Promise<boolean> => readFile(path.join(...parts)).then(() => true, () => false);
const args = (overrides: Partial<Parameters<typeof runInstall>[0]> = {}): Parameters<typeof runInstall>[0] => ({
  tools: ["claude"],
  scope: "project",
  dryRun: false,
  json: false,
  ...overrides,
});

describe("runInstall", () => {
  it("installs into the current folder and says what it did", async () => {
    const output = await runInstall(args({ tools: ["claude", "codex"] }), deps);

    expect(await exists(deps.cwd, ".claude", "skills", "emd-one", "SKILL.md")).toBe(true);
    expect(await exists(deps.cwd, ".agents", "skills", "emd-one", "SKILL.md")).toBe(true);
    expect(await exists(deps.cwd, ".codex", "agents", "emd-agent.toml")).toBe(true);
    expect(output).toContain("Installed");
    expect(output).toContain("create  .claude/skills/emd-one");
    expect(output).toContain("create  .codex/agents/emd-agent.toml");
    expect(output).toContain("Claude Code");
  });

  it("installs slash commands for the tools that have command files, and says where the others get theirs", async () => {
    const output = await runInstall(args({ tools: ["gemini", "opencode", "claude"] }), deps);

    expect(await exists(deps.cwd, ".gemini", "commands", "emd", "new.toml")).toBe(true);
    expect(await exists(deps.cwd, ".opencode", "commands", "emd-new.md")).toBe(true);
    expect(output).toContain("create  .gemini/commands/emd/new.toml");
    expect(output).toContain("create  .opencode/commands/emd-new.md");
    expect(output).toMatch(/Claude Code.*plugin install emd@emd/);
  });

  it("installs into the home folder in user scope", async () => {
    await runInstall(args({ tools: ["codex"], scope: "user" }), deps);

    expect(await exists(deps.home, ".agents", "skills", "emd-one", "SKILL.md")).toBe(true);
    expect(await exists(deps.cwd, ".agents")).toBe(false);
  });

  it("writes nothing on a dry run and says it would", async () => {
    const output = await runInstall(args({ dryRun: true }), deps);

    expect(output).toContain("Would install");
    expect(await exists(deps.cwd, ".claude", "skills", "emd-one", "SKILL.md")).toBe(false);
  });

  it("reports unchanged on a second run", async () => {
    await runInstall(args(), deps);

    expect(await runInstall(args(), deps)).toContain("unchanged  .claude/skills/emd-one");
  });

  it("prints a summary a script can read", async () => {
    const parsed = JSON.parse(await runInstall(args({ tools: ["claude", "antigravity"], json: true, dryRun: true }), deps)) as {
      scope: string;
      dryRun: boolean;
      units: Array<{ kind: string; name: string; location: string; action: string }>;
      notes: string[];
    };

    expect(parsed.scope).toBe("project");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.units).toContainEqual({ kind: "skill", name: "emd-one", location: ".claude/skills/emd-one", action: "create" });
    expect(parsed.units).toContainEqual({ kind: "agent", name: "emd-agent", location: ".claude/agents/emd-agent.md", action: "create" });
    expect(parsed.notes.join(" ")).toMatch(/Antigravity/);
  });

  it("shows what a tool cannot get", async () => {
    const output = await runInstall(args({ tools: ["antigravity"] }), deps);

    expect(output).toContain("Notes:");
    expect(output).toMatch(/Antigravity.*subagent/s);
  });

  it("reports a conflict with something it did not install", async () => {
    await put(deps.cwd, ".claude/skills/emd-one/SKILL.md", "mine\n");

    expect(await errorCodeOfAsync(() => runInstall(args(), deps))).toBe("CONFLICT");
  });

  it("fails clearly when this copy of emd ships nothing to install", async () => {
    await rm(deps.contentDir, { recursive: true });

    expect(await errorCodeOfAsync(() => runInstall(args(), deps))).toBe("NOT_FOUND");
  });

  it("says when no selected tool can take anything", async () => {
    const output = await runInstall(args({ tools: ["antigravity"], scope: "user" }), deps);

    expect(output).toContain("Nothing to install");
    expect(output).toMatch(/differs by product/);
  });
});

describe("runUninstall", () => {
  it("removes what emd installed and keeps everything else", async () => {
    await runInstall(args({ tools: ["claude", "codex"] }), deps);
    await put(deps.cwd, ".claude/skills/mine/SKILL.md", "mine\n");

    const output = await runUninstall({ tools: ["claude", "codex"], scope: "project", dryRun: false, json: false }, deps);

    expect(output).toContain("Removed");
    expect(await exists(deps.cwd, ".claude", "skills", "emd-one", "SKILL.md")).toBe(false);
    expect(await exists(deps.cwd, ".codex", "agents", "emd-agent.toml")).toBe(false);
    expect(await exists(deps.cwd, ".claude", "skills", "mine", "SKILL.md")).toBe(true);
  });

  it("removes the slash commands too, and the emd folder it created", async () => {
    await runInstall(args({ tools: ["gemini", "opencode"] }), deps);

    await runUninstall({ tools: ["gemini", "opencode"], scope: "project", dryRun: false, json: false }, deps);

    expect(await exists(deps.cwd, ".gemini", "commands", "emd", "new.toml")).toBe(false);
    expect(await exists(deps.cwd, ".opencode", "commands", "emd-new.md")).toBe(false);
  });

  it("lists what it would remove on a dry run", async () => {
    await runInstall(args(), deps);

    const output = await runUninstall({ tools: ["claude"], scope: "project", dryRun: true, json: false }, deps);

    expect(output).toContain("Would remove");
    expect(await exists(deps.cwd, ".claude", "skills", "emd-one", "SKILL.md")).toBe(true);
  });

  it("says so when there is nothing to remove", async () => {
    expect(await runUninstall({ tools: ["claude"], scope: "project", dryRun: false, json: false }, deps)).toContain("Nothing installed by EMD");
  });
});

describe("runStatus", () => {
  it("lists what is installed with its version", async () => {
    await runInstall(args({ tools: ["claude"] }), deps);

    const output = await runStatus({ tools: ["claude"], scope: "project", json: false }, deps);

    expect(output).toContain(".claude/skills/emd-one");
    expect(output).toContain("1.0.0");
    expect(output).toContain("up to date");
  });

  it("flags files from an older emd", async () => {
    await runInstall(args({ tools: ["claude"] }), { ...deps, version: "0.9.0" });

    const output = await runStatus({ tools: ["claude"], scope: "project", json: false }, deps);

    expect(output).toContain("0.9.0");
    expect(output).toContain("older");
    expect(output).toContain("emd install");
  });

  it("lists installed commands with their kind", async () => {
    await runInstall(args({ tools: ["gemini"] }), deps);

    const parsed = JSON.parse(await runStatus({ tools: ["gemini"], scope: "project", json: true }, deps)) as {
      items: Array<{ kind: string; name: string; location: string }>;
    };

    expect(parsed.items).toContainEqual(expect.objectContaining({ kind: "command", name: "emd:new", location: ".gemini/commands/emd/new.toml" }));
  });

  it("says so when nothing is installed", async () => {
    expect(await runStatus({ tools: ["claude"], scope: "project", json: false }, deps)).toContain("Nothing installed by EMD");
  });

  it("prints JSON", async () => {
    await runInstall(args({ tools: ["claude"] }), deps);

    const parsed = JSON.parse(await runStatus({ tools: ["claude"], scope: "project", json: true }, deps)) as {
      version: string;
      items: Array<{ kind: string; name: string; location: string; version: string; current: boolean }>;
    };

    expect(parsed.version).toBe("1.0.0");
    expect(parsed.items).toContainEqual({ kind: "skill", name: "emd-one", location: ".claude/skills/emd-one", version: "1.0.0", current: true });
  });
});
