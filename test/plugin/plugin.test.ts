import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../src/install/frontmatter.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = async (file: string): Promise<Record<string, unknown>> => JSON.parse(await readFile(path.join(ROOT, file), "utf8")) as Record<string, unknown>;

const manifest = await readJson(".claude-plugin/plugin.json");
const marketplace = await readJson(".claude-plugin/marketplace.json");
const commands = await Promise.all(
  (await readdir(path.join(ROOT, "commands")))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map(async (name) => ({ name: name.slice(0, -".md".length), ...parseFrontmatter(await readFile(path.join(ROOT, "commands", name), "utf8")) })),
);

/** Names Claude Code reserves for Anthropic's own plugins (from its plugin manifest reference). */
const RESERVED_PREFIX = /^(claude|anthropic|anthropics|cc-plugin)(-|$)/;

describe("the Claude Code plugin", () => {
  it("is named emd, so its commands read /emd:new, /emd:plan and so on", () => {
    expect(manifest.name).toBe("emd");
    expect(manifest.name).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(String(manifest.name)).not.toMatch(RESERVED_PREFIX);
  });

  it("describes itself and credits the handle, with no email", () => {
    expect(String(manifest.description).length).toBeGreaterThan(20);
    expect(manifest.license).toBe("MIT");
    expect(JSON.stringify(manifest.author)).not.toMatch(/@/);
  });

  it("sets no version, so every commit reaches users as an update", () => {
    expect(manifest).not.toHaveProperty("version");
  });

  it("is listed by the marketplace under the same name, from the repository root", () => {
    const plugins = marketplace.plugins as Array<{ name: string; source: string; description: string }>;

    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe(manifest.name);
    expect(plugins[0]?.source).toBe("./");
    expect(plugins[0]?.description.length).toBeGreaterThan(20);
    expect(JSON.stringify(marketplace.owner)).not.toMatch(/@/);
  });

  it("offers the slash commands the README promises", () => {
    expect(commands.map((command) => command.name)).toEqual(["fix-build", "new", "plan", "review", "versions"]);
  });

  it.each(commands.map((command) => [command.name, command] as const))("/emd:%s has a description, an argument hint and uses what the user typed", (_name, command) => {
    expect(String(command.fields.description).length).toBeGreaterThan(20);
    expect(typeof command.fields["argument-hint"]).toBe("string");
    expect(command.body).toContain("$ARGUMENTS");
  });

  it("keeps /emd:plan read-only until the user confirms", () => {
    const plan = commands.find((command) => command.name === "plan");

    expect(plan?.body).toMatch(/Do not create or change any file yet/);
    expect(plan?.body).toMatch(/wait for the user to confirm/);
  });
});
