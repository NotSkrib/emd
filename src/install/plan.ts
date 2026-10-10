import path from "node:path";
import type { Content } from "./content.js";
import { emitAgent, emitSkillFiles } from "./emit.js";
import { chooseAgentSinks, chooseSkillFolders, toolLabel, type Scope, type ToolId } from "./tools.js";

export interface InstallOptions {
  tools: readonly ToolId[];
  scope: Scope;
  /** The project folder, or the home folder in user scope. */
  root: string;
  /** The version written into the ownership marker. */
  version: string;
}

export interface PlannedFile {
  /** Absolute path. */
  path: string;
  content: string;
}

/** One thing installed: a whole skill folder, or a single agent file. */
export interface Unit {
  kind: "skill" | "agent";
  name: string;
  /** The skill's folder, or the agent's file. */
  location: string;
  files: PlannedFile[];
}

export interface InstallPlan {
  scope: Scope;
  root: string;
  tools: readonly ToolId[];
  units: Unit[];
  /** Tools served by each parent folder (absolute), for the summary. */
  serves: Map<string, ToolId[]>;
  /** What some tool cannot get, in plain words. */
  notes: string[];
}

/** Decides what goes where. It reads nothing and writes nothing. */
export function planInstall(content: Content, options: InstallOptions): InstallPlan {
  const { tools, scope, root, version } = options;
  const skillFolders = chooseSkillFolders(tools, scope);
  const agentSinks = chooseAgentSinks(tools, scope);
  const absolute = (relative: string): string => path.join(root, ...relative.split("/"));

  const skillUnits = skillFolders.folders.flatMap((folder) =>
    content.skills.map((skill): Unit => {
      const location = path.join(absolute(folder), skill.name);
      const files = emitSkillFiles(skill, version).map((file) => ({ path: path.join(location, ...file.path.split("/")), content: file.content }));
      return { kind: "skill", name: skill.name, location, files };
    }),
  );
  const agentUnits = agentSinks.sinks.flatMap((sink) =>
    content.agents.map((agent): Unit => {
      const emitted = emitAgent(agent, sink.format, version);
      const location = path.join(absolute(sink.folder), emitted.fileName);
      return { kind: "agent", name: agent.name, location, files: [{ path: location, content: emitted.content }] };
    }),
  );

  const serves = new Map([...skillFolders.serves].map(([folder, served]) => [absolute(folder), served]));
  const duplicates =
    skillFolders.readsSeveral.length === 0
      ? []
      : [`${skillFolders.readsSeveral.map(toolLabel).join(", ")} read more than one of the skill folders above and may list each skill twice. The copies are identical.`];
  const notes = [
    ...skillFolders.unsupported.map(({ tool, reason }) => `${toolLabel(tool)}: ${reason}`),
    ...agentSinks.unsupported.map(({ tool, reason }) => `${toolLabel(tool)}: ${reason}`),
    ...duplicates,
  ];
  return { scope, root, tools, units: [...skillUnits, ...agentUnits], serves, notes };
}
