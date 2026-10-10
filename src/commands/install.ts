import path from "node:path";
import { EmdError } from "../errors.js";
import { findManaged, installPlan, removeManaged, type ManagedItem } from "../install/apply.js";
import { loadContent } from "../install/content.js";
import { planInstall } from "../install/plan.js";
import { toolLabel, type Scope, type ToolId } from "../install/tools.js";
import { compareDotted } from "../versions/compare.js";

export interface InstallArgs {
  tools: readonly ToolId[];
  scope: Scope;
  dryRun: boolean;
  json: boolean;
}

export interface StatusArgs {
  tools: readonly ToolId[];
  scope: Scope;
  json: boolean;
}

export interface InstallDeps {
  /** The folder that holds `skills/`, `agents/` and `commands/`: the root of the emd package. */
  contentDir: string;
  /** The project folder, used in project scope. */
  cwd: string;
  /** The home folder, used in user scope. */
  home: string;
  /** This emd's version, written into what it installs. */
  version: string;
}

/** Puts emd's skills, subagents and slash commands where the chosen AI tools read them. */
export async function runInstall(args: InstallArgs, deps: InstallDeps): Promise<string> {
  const content = await loadContent(deps.contentDir);
  if (content.skills.length === 0 && content.agents.length === 0 && content.commands.length === 0) {
    throw new EmdError("NOT_FOUND", `This copy of emd ships no skills, agents or commands (looked in ${deps.contentDir}). Reinstall emd.`);
  }
  const root = rootFor(args.scope, deps);
  const plan = planInstall(content, { tools: args.tools, scope: args.scope, root, version: deps.version });
  const outcomes = await installPlan(plan, { dryRun: args.dryRun });

  const units = outcomes.map((outcome) => ({ kind: outcome.unit.kind, name: outcome.unit.name, location: display(root, outcome.unit.location), action: outcome.action }));
  if (args.json) return JSON.stringify({ scope: args.scope, root, dryRun: args.dryRun, units, notes: plan.notes }, null, 2);

  if (outcomes.length === 0) return ["Nothing to install.", ...formatNotes(plan.notes)].join("\n");
  const labels = args.tools.map(toolLabel).join(", ");
  const lines = [
    `${args.dryRun ? "Would install" : "Installed"} EMD for ${labels} in ${root}:`,
    ...units.map((unit) => `  ${unit.action}  ${unit.location}`),
    ...formatServes(plan.serves, root),
    ...formatNotes(plan.notes),
    ...(args.dryRun ? [] : ["", "Restart your AI tool, or start a new session, so it picks the files up."]),
  ];
  return lines.join("\n");
}

/** Removes only what carries emd's marker, from every folder the chosen tools read. */
export async function runUninstall(args: InstallArgs, deps: InstallDeps): Promise<string> {
  const root = rootFor(args.scope, deps);
  const found = await findManaged(root, args.scope, args.tools);
  const items = args.dryRun ? found : await removeManaged(found);
  const shown = items.map((item) => ({ kind: item.kind, name: item.name, location: display(root, item.location), version: item.version }));
  if (args.json) return JSON.stringify({ scope: args.scope, root, dryRun: args.dryRun, items: shown }, null, 2);
  if (shown.length === 0) return `Nothing installed by EMD was found in ${root}.`;
  return [`${args.dryRun ? "Would remove" : "Removed"} from ${root}:`, ...shown.map((item) => `  ${item.location}`)].join("\n");
}

/** Lists what emd installed and whether it matches this version. */
export async function runStatus(args: StatusArgs, deps: InstallDeps): Promise<string> {
  const root = rootFor(args.scope, deps);
  const items = (await findManaged(root, args.scope, args.tools)).map((item) => describeItem(item, root, deps.version));
  if (args.json) return JSON.stringify({ version: deps.version, scope: args.scope, root, items }, null, 2);
  if (items.length === 0) return `Nothing installed by EMD was found in ${root}.`;

  const outdated = items.some((item) => !item.current);
  return [
    `EMD ${deps.version}. Installed in ${root} (${args.scope}):`,
    ...items.map((item) => `  ${item.kind.padEnd(7)}  ${item.location}  ${item.version} (${versionNote(item.version, deps.version)})`),
    ...(outdated ? ["", `Run \`emd install --tool <tools> --scope ${args.scope}\` to bring the older files up to date.`] : []),
  ].join("\n");
}

function versionNote(installed: string, current: string): string {
  if (installed === current) return "up to date";
  return compareDotted(installed, current) < 0 ? "older" : "newer than this emd";
}

function describeItem(item: ManagedItem, root: string, current: string) {
  return { kind: item.kind, name: item.name, location: display(root, item.location), version: item.version, current: item.version === current };
}

function rootFor(scope: Scope, deps: InstallDeps): string {
  return scope === "user" ? deps.home : deps.cwd;
}

function display(root: string, location: string): string {
  return path.relative(root, location).split(path.sep).join("/");
}

function formatServes(serves: ReadonlyMap<string, readonly ToolId[]>, root: string): string[] {
  if (serves.size === 0) return [];
  return ["", ...[...serves].map(([folder, tools]) => `Skills in ${display(root, folder)} are read by ${tools.map(toolLabel).join(", ")}.`)];
}

function formatNotes(notes: readonly string[]): string[] {
  return notes.length === 0 ? [] : ["", "Notes:", ...notes.map((note) => `  - ${note}`)];
}
