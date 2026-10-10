import { lstat, mkdir, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { EmdError } from "../errors.js";
import { readRegularText } from "../util/files.js";
import { managedVersion } from "./emit.js";
import type { InstallPlan, Unit } from "./plan.js";
import { allAgentFolders, allSkillFolders, type Scope, type ToolId } from "./tools.js";

const MAX_READ_BYTES = 1024 * 1024;
const NOT_OURS = "exists and was not installed by EMD";
const LINK = "is a link, which EMD will not write through";

export type UnitAction = "create" | "update" | "unchanged" | "conflict";

export interface UnitOutcome {
  unit: Unit;
  action: UnitAction;
  /** Why the unit is in conflict. */
  reason?: string;
  /** Files EMD installed earlier that this version no longer ships. */
  stale: string[];
}

/** Something EMD installed earlier, found by its ownership marker. */
export interface ManagedItem {
  kind: "skill" | "agent";
  name: string;
  /** The skill's folder, or the agent's file. */
  location: string;
  version: string;
}

/**
 * Installs a plan. Everything is checked before anything is written: a single conflict stops the
 * whole install, so a failed run never leaves half a set behind. Only files that carry EMD's
 * marker are ever replaced.
 */
export async function installPlan(plan: InstallPlan, options: { dryRun: boolean }): Promise<UnitOutcome[]> {
  const outcomes = await Promise.all(plan.units.map(inspectUnit));
  const conflicts = outcomes.filter((outcome) => outcome.action === "conflict");
  if (conflicts.length > 0) {
    const lines = conflicts.map((outcome) => `  ${outcome.unit.location}: ${outcome.reason ?? NOT_OURS}`);
    const places = conflicts.length === 1 ? "one place" : `${conflicts.length} places`;
    throw new EmdError(
      "CONFLICT",
      `Nothing was changed, because ${places} would overwrite something EMD did not install:\n${lines.join("\n")}\nMove or rename it and run the command again.`,
    );
  }
  if (!options.dryRun) for (const outcome of outcomes) await writeUnit(outcome);
  return outcomes;
}

/** Finds what EMD installed in every folder the tools read, ignoring anything without its marker. */
export async function findManaged(root: string, scope: Scope, tools: readonly ToolId[]): Promise<ManagedItem[]> {
  const absolute = (folder: string): string => path.join(root, ...folder.split("/"));
  const skills = await Promise.all(allSkillFolders(tools, scope).map((folder) => findSkills(absolute(folder))));
  const agents = await Promise.all(allAgentFolders(tools, scope).map((folder) => findAgents(absolute(folder))));
  return [...skills.flat(), ...agents.flat()];
}

/** Deletes the given items. Each is checked for its marker again first, and links are never followed. */
export async function removeManaged(items: readonly ManagedItem[]): Promise<ManagedItem[]> {
  const removed: ManagedItem[] = [];
  for (const item of items) {
    const marked = item.kind === "skill" ? path.join(item.location, "SKILL.md") : item.location;
    if (managedVersion((await readIfFile(marked)) ?? "") === undefined) continue;
    if (item.kind === "skill") await removeTree(item.location);
    else await unlink(item.location);
    removed.push(item);
  }
  return removed;
}

function inspectUnit(unit: Unit): Promise<UnitOutcome> {
  return unit.kind === "skill" ? inspectSkill(unit) : inspectAgent(unit);
}

async function inspectAgent(unit: Unit): Promise<UnitOutcome> {
  const file = unit.files[0];
  const kind = await entryKind(unit.location);
  if (kind === "missing") return { unit, action: "create", stale: [] };
  if (kind === "link") return conflict(unit, LINK);
  if (kind !== "file" || file === undefined) return conflict(unit, NOT_OURS);

  const existing = await readIfFile(unit.location);
  if (existing === file.content) return { unit, action: "unchanged", stale: [] };
  if (existing === undefined || managedVersion(existing) === undefined) return conflict(unit, NOT_OURS);
  return { unit, action: "update", stale: [] };
}

async function inspectSkill(unit: Unit): Promise<UnitOutcome> {
  const kind = await entryKind(unit.location);
  if (kind === "missing") return { unit, action: "create", stale: [] };
  if (kind === "link") return conflict(unit, LINK);
  if (kind !== "directory") return conflict(unit, NOT_OURS);

  const main = await readIfFile(path.join(unit.location, "SKILL.md"));
  if (main === undefined || managedVersion(main) === undefined) return conflict(unit, NOT_OURS);

  const planned = new Set(unit.files.map((file) => file.path));
  let changed = false;
  for (const file of unit.files) {
    const state = await entryKind(file.path);
    if (state === "link" || state === "directory") return conflict(unit, `${path.basename(file.path)} is a ${state === "link" ? "link" : "folder"} where a file belongs`);
    if (state === "missing" || (await readIfFile(file.path)) !== file.content) changed = true;
  }
  const existing = await listFiles(unit.location);
  if (existing.links.length > 0) return conflict(unit, "holds a link, which EMD will not touch");
  const stale = existing.files.filter((file) => !planned.has(file));
  return { unit, action: changed || stale.length > 0 ? "update" : "unchanged", stale };
}

async function writeUnit(outcome: UnitOutcome): Promise<void> {
  if (outcome.action !== "create" && outcome.action !== "update") return;
  for (const file of outcome.unit.files) {
    await mkdir(path.dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content);
  }
  for (const file of outcome.stale) await unlink(file);
  if (outcome.stale.length > 0) await removeEmptyFolders(outcome.unit.location);
}

async function findSkills(folder: string): Promise<ManagedItem[]> {
  const items: ManagedItem[] = [];
  for (const entry of await listEntries(folder)) {
    if (!entry.isDirectory() || !entry.name.startsWith("emd-")) continue;
    const location = path.join(folder, entry.name);
    const version = managedVersion((await readIfFile(path.join(location, "SKILL.md"))) ?? "");
    if (version !== undefined) items.push({ kind: "skill", name: entry.name, location, version });
  }
  return items;
}

async function findAgents(folder: string): Promise<ManagedItem[]> {
  const items: ManagedItem[] = [];
  for (const entry of await listEntries(folder)) {
    if (!entry.isFile() || !entry.name.startsWith("emd-") || !/\.(md|toml)$/.test(entry.name)) continue;
    const location = path.join(folder, entry.name);
    const version = managedVersion((await readIfFile(location)) ?? "");
    if (version !== undefined) items.push({ kind: "agent", name: entry.name.replace(/\.(md|toml)$/, ""), location, version });
  }
  return items;
}

type EntryKind = "missing" | "file" | "directory" | "link";

async function entryKind(file: string): Promise<EntryKind> {
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink()) return "link";
    return info.isDirectory() ? "directory" : "file";
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw new EmdError("NOT_FOUND", `Cannot look at ${file}.`, { cause });
  }
}

async function readIfFile(file: string): Promise<string | undefined> {
  try {
    return await readRegularText(file, MAX_READ_BYTES, file, "CONFLICT");
  } catch {
    return undefined;
  }
}

async function listEntries(folder: string) {
  try {
    return await readdir(folder, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new EmdError("NOT_FOUND", `Cannot read ${folder}.`, { cause });
  }
}

/** Every regular file under a folder, and any link, without following links. */
async function listFiles(folder: string): Promise<{ files: string[]; links: string[] }> {
  const files: string[] = [];
  const links: string[] = [];
  for (const entry of await listEntries(folder)) {
    const full = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) {
      links.push(full);
    } else if (entry.isDirectory()) {
      const inner = await listFiles(full);
      files.push(...inner.files);
      links.push(...inner.links);
    } else {
      files.push(full);
    }
  }
  return { files, links };
}

async function removeEmptyFolders(folder: string): Promise<void> {
  for (const entry of await listEntries(folder)) {
    if (!entry.isDirectory()) continue;
    const full = path.join(folder, entry.name);
    await removeEmptyFolders(full);
    if ((await listEntries(full)).length === 0) await rmdir(full);
  }
}

/** Deletes a folder bottom-up with plain unlink and rmdir, so nothing is followed through a link. */
async function removeTree(folder: string): Promise<void> {
  for (const entry of await listEntries(folder)) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) await removeTree(full);
    else await unlink(full);
  }
  await rmdir(folder);
}

function conflict(unit: Unit, reason: string): UnitOutcome {
  return { unit, action: "conflict", reason, stale: [] };
}
