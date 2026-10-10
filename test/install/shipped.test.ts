import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/install/content.js";
import { planInstall } from "../../src/install/plan.js";
import { TOOL_IDS } from "../../src/install/tools.js";
import { loadPresets } from "../../src/presets/load.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const content = await loadContent(ROOT);
const presets = await loadPresets(path.join(ROOT, "presets"));

const COMMANDS: ReadonlySet<string> = new Set(["versions", "preset", "new", "install", "uninstall", "status"]);
const FLAGS: ReadonlySet<string> = new Set(["--mc", "--set", "--dry-run", "--preset", "--tool", "--scope", "--json", "--dir", "--force", "--refresh", "--help"]);

const commandFiles = (await readdir(path.join(ROOT, "commands"))).filter((name) => name.endsWith(".md")).sort();
const commandDocuments = await Promise.all(
  commandFiles.map(async (name) => ({ label: `commands/${name}`, text: await readFile(path.join(ROOT, "commands", name), "utf8") })),
);

/** Every file's text: skill files, the agents' own bodies and the Claude Code slash commands. */
const documents: Array<{ label: string; text: string }> = [
  ...content.skills.flatMap((skill) => skill.files.map((file) => ({ label: `skills/${skill.name}/${file.path}`, text: file.content }))),
  ...content.agents.map((agent) => ({ label: `agents/${agent.name}.md`, text: agent.body })),
  ...commandDocuments,
];

/** The code in a document: inline `spans` and the lines of fenced blocks. */
function codeSnippets(text: string): string[] {
  const fenced = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap((match) => (match[1] ?? "").split("\n"));
  const inline = [...text.replace(/```[\s\S]*?```/g, "").matchAll(/`([^`\n]+)`/g)].map((match) => match[1] ?? "");
  return [...fenced, ...inline].map((snippet) => snippet.trim()).filter((snippet) => snippet !== "");
}

describe("shipped skills and agents", () => {
  it("ship the expected set", () => {
    expect(content.skills.map((skill) => skill.name)).toEqual([
      "emd-build-troubleshooting",
      "emd-folia-threading",
      "emd-local-testing",
      "emd-minecraft-dev",
      "emd-packs",
      "emd-preset-guide",
      "emd-release-checklist",
      "emd-upgrade-minecraft",
      "emd-version-facts",
    ]);
    expect(content.agents.map((agent) => agent.name)).toEqual(["emd-builder", "emd-doctor", "emd-planner", "emd-reviewer", "emd-upgrader"]);
  });

  it("tell the model when to use each skill", () => {
    for (const skill of content.skills) expect(skill.description, skill.name).toMatch(/\bUse when\b/);
    for (const agent of content.agents) expect(agent.description, agent.name).toMatch(/\bUse (when|after)\b/);
  });

  it("install for every tool in both scopes without a conversion error", () => {
    for (const scope of ["project", "user"] as const) {
      for (const tool of TOOL_IDS) {
        expect(() => planInstall(content, { tools: [tool], scope, root: ROOT, version: "0.0.0" }), `${tool} ${scope}`).not.toThrow();
      }
    }
    const everything = planInstall(content, { tools: TOOL_IDS, scope: "project", root: ROOT, version: "0.0.0" });

    expect(everything.units.length).toBeGreaterThan(content.skills.length + content.agents.length);
  });

  it("install every slash command of the Claude Code plugin for Gemini CLI and OpenCode", () => {
    expect(content.commands.map((command) => command.name)).toEqual(commandFiles.map((file) => file.slice(0, -".md".length)));

    const plan = planInstall(content, { tools: ["gemini", "opencode"], scope: "project", root: ROOT, version: "0.0.0" });
    const places = plan.units.filter((unit) => unit.kind === "command").map((unit) => path.relative(ROOT, unit.location).split(path.sep).join("/"));

    expect(places).toEqual([
      ...content.commands.map((command) => `.gemini/commands/emd/${command.name}.toml`),
      ...content.commands.map((command) => `.opencode/commands/emd-${command.name}.md`),
    ]);
  });

  it("refer only to slash commands that exist", () => {
    const known = new Set(content.commands.map((command) => command.name));

    for (const { label, text } of documents) {
      for (const match of text.matchAll(/\/emd:([a-z][a-z-]*)/g)) {
        expect(known.has(match[1] ?? ""), `${label} mentions /emd:${match[1]}, which is not shipped`).toBe(true);
      }
    }
  });

  it("refer only to skills and agents that exist", () => {
    const known = new Set([...content.skills.map((skill) => skill.name), ...content.agents.map((agent) => agent.name)]);

    for (const { label, text } of documents) {
      const mentioned = [...text.matchAll(/`(emd-[a-z][a-z-]*)`/g)].map((match) => match[1] ?? "");
      for (const name of mentioned) expect(known.has(name), `${label} mentions \`${name}\`, which is not shipped`).toBe(true);
    }
  });

  it("mention only emd commands and flags that exist", () => {
    for (const { label, text } of documents) {
      for (const snippet of codeSnippets(text)) {
        const words = snippet.split(/\s+/);
        const start = words.findIndex((word, index) => word === "emd" || (word === "npx" && words[index + 1] === "emd-minecraft"));
        if (start === -1) continue;
        const afterRunner = words.slice(start + (words[start] === "npx" ? 2 : 1));
        const command = afterRunner[0];
        if (command !== undefined && !command.startsWith("<") && command !== "...") {
          expect(COMMANDS.has(command), `${label}: \`${snippet}\` uses an unknown emd command`).toBe(true);
        }
        for (const word of afterRunner.filter((candidate) => candidate.startsWith("--"))) {
          const flag = word.replace(/=.*$/, "");
          expect(FLAGS.has(flag), `${label}: \`${snippet}\` uses an unknown flag ${flag}`).toBe(true);
        }
      }
    }
  });

  it("list every shipped preset in the main skill, and only presets that exist", () => {
    const main = content.skills.find((skill) => skill.name === "emd-minecraft-dev")?.files.find((file) => file.path === "SKILL.md")?.content ?? "";
    const listed = [...main.matchAll(/^\| `([a-z][a-z-]*)` \|/gm)].map((match) => match[1] ?? "");

    expect(listed.sort()).toEqual(presets.map((preset) => preset.manifest.id).sort());
  });

  it("keep every skill under the length the Agent Skills format recommends", () => {
    for (const skill of content.skills) {
      const main = skill.files.find((file) => file.path === "SKILL.md")?.content ?? "";
      expect(main.split("\n").length, skill.name).toBeLessThanOrEqual(500);
    }
  });
});
