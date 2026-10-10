import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { EmdError } from "../errors.js";
import { isSafeRelativePath } from "../presets/paths.js";
import { readRegularText } from "../util/files.js";
import { parseFrontmatter } from "./frontmatter.js";

const NAME = /^emd(-[a-z0-9]+)+$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SKILL_LINES = 500;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_FILES_PER_SKILL = 50;
const MAX_DEPTH = 3;
const SKILL_FIELDS: ReadonlySet<string> = new Set(["name", "description", "license"]);
const AGENT_FIELDS: ReadonlySet<string> = new Set(["name", "description", "readonly"]);

export interface SkillFile {
  /** Path inside the skill folder, with forward slashes. */
  path: string;
  content: string;
}

export interface Skill {
  name: string;
  description: string;
  /** Every file of the skill, `SKILL.md` included. */
  files: SkillFile[];
}

export interface Agent {
  name: string;
  description: string;
  /** The agent must not change files. Each tool expresses this its own way. */
  readonly: boolean;
  /** The instructions, without the header. */
  body: string;
}

export interface Content {
  skills: Skill[];
  agents: Agent[];
}

/**
 * Loads EMD's own skills (`skills/<name>/SKILL.md` and its files) and agents (`agents/<name>.md`)
 * and checks them against the Agent Skills format before anything is installed, so a mistake in
 * a shipped file fails the tests instead of a user's tool.
 */
export async function loadContent(root: string): Promise<Content> {
  const [skills, agents] = await Promise.all([loadSkills(path.join(root, "skills")), loadAgents(path.join(root, "agents"))]);
  return { skills, agents };
}

async function loadSkills(directory: string): Promise<Skill[]> {
  const folders = (await listEntries(directory)).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const skills = await Promise.all(folders.map((folder) => loadSkill(directory, folder)));
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadSkill(directory: string, folder: string): Promise<Skill> {
  assertName(folder, `skill folder ${JSON.stringify(folder)}`);
  const files = await collectFiles(path.join(directory, folder), folder);
  const main = files.find((file) => file.path === "SKILL.md");
  if (!main) throw bad(`skills/${folder} has no SKILL.md.`);

  const { fields } = parseFrontmatter(main.content);
  assertOnlyFields(fields, SKILL_FIELDS, `skills/${folder}/SKILL.md`);
  if (fields.name !== folder) throw bad(`skills/${folder}/SKILL.md: the name must match the folder.`);
  const description = fields.description;
  if (typeof description !== "string" || description.length === 0 || description.length > MAX_DESCRIPTION_LENGTH) {
    throw bad(`skills/${folder}/SKILL.md: the description must be 1 to ${MAX_DESCRIPTION_LENGTH} characters.`);
  }
  if (/[\r\n]/.test(description)) throw bad(`skills/${folder}/SKILL.md: the description must be a single line.`);
  if (main.content.split("\n").length > MAX_SKILL_LINES + 1) {
    throw bad(`skills/${folder}/SKILL.md is longer than ${MAX_SKILL_LINES} lines. Move detail into references/.`);
  }
  return { name: folder, description, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

async function collectFiles(directory: string, label: string, prefix = "", depth = 0): Promise<SkillFile[]> {
  if (depth > MAX_DEPTH) throw bad(`skills/${label} is nested deeper than ${MAX_DEPTH} folders.`);
  const found: SkillFile[] = [];
  for (const entry of await listEntries(directory)) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.name.startsWith(".")) throw bad(`skills/${label}/${relative} is a hidden file, which skills do not ship.`);
    if (!isSafeRelativePath(relative)) throw bad(`skills/${label}/${relative} has an unsafe path.`);
    const full = path.join(directory, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw bad(`skills/${label}/${relative} is a link, which is not allowed.`);
    if (info.isDirectory()) {
      found.push(...(await collectFiles(full, label, relative, depth + 1)));
    } else {
      const content = await readRegularText(full, MAX_FILE_BYTES, `skills/${label}/${relative}`, "BAD_CONTENT");
      if (content.includes("\u0000")) throw bad(`skills/${label}/${relative} is a binary file. Skills ship text only.`);
      found.push({ path: relative, content });
    }
    if (found.length > MAX_FILES_PER_SKILL) throw bad(`skills/${label} has more than ${MAX_FILES_PER_SKILL} files.`);
  }
  return found;
}

async function loadAgents(directory: string): Promise<Agent[]> {
  const files = (await listEntries(directory)).filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name);
  const agents = await Promise.all(files.map((file) => loadAgent(directory, file)));
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadAgent(directory: string, file: string): Promise<Agent> {
  const stem = file.slice(0, -".md".length);
  assertName(stem, `agent file ${JSON.stringify(file)}`);
  const label = `agents/${file}`;
  const { fields, body } = parseFrontmatter(await readRegularText(path.join(directory, file), MAX_FILE_BYTES, label, "BAD_CONTENT"));
  assertOnlyFields(fields, AGENT_FIELDS, label);
  if (fields.name !== stem) throw bad(`${label}: the name must match the file name.`);
  const description = fields.description;
  if (typeof description !== "string" || description.length === 0 || description.length > MAX_DESCRIPTION_LENGTH || /[\r\n]/.test(description)) {
    throw bad(`${label}: the description must be 1 to ${MAX_DESCRIPTION_LENGTH} characters on one line.`);
  }
  if (fields.readonly !== undefined && typeof fields.readonly !== "boolean") throw bad(`${label}: readonly must be true or false.`);
  if (body.trim() === "") throw bad(`${label} has no instructions after the header.`);
  return { name: stem, description, readonly: fields.readonly === true, body };
}

function assertName(name: string, what: string): void {
  if (name.length > MAX_NAME_LENGTH || !NAME.test(name)) {
    throw bad(`${what} must be lowercase words joined by single hyphens, start with "emd-" and be at most ${MAX_NAME_LENGTH} characters.`);
  }
}

function assertOnlyFields(fields: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  const unknown = Object.keys(fields).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw bad(`${label}: the field ${unknown.map((key) => JSON.stringify(key)).join(", ")} is not used by EMD content.`);
}

async function listEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new EmdError("BAD_CONTENT", `Cannot read ${directory}.`, { cause });
  }
}

function bad(message: string): EmdError {
  return new EmdError("BAD_CONTENT", message);
}
