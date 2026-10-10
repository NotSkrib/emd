import { EmdError } from "../errors.js";

export const TOOL_IDS = ["claude", "opencode", "copilot", "codex", "cursor", "gemini", "antigravity"] as const;
export type ToolId = (typeof TOOL_IDS)[number];
export type Scope = "project" | "user";

/** How a tool wants a subagent written. One format can serve several tools. */
export type AgentFormat = "claude-md" | "opencode-md" | "gemini-md" | "codex-toml";

export interface AgentSink {
  format: AgentFormat;
  /** Relative to the project root, or to the home folder in user scope. */
  folder: string;
}

interface ToolSpec {
  label: string;
  /** Folders the tool reads skills from, most preferred first. Empty when the folder is unknown. */
  skills: Record<Scope, readonly string[]>;
  /** Where the tool reads subagent files, most preferred first. Empty when it has none. */
  agents: Record<Scope, readonly AgentSink[]>;
  /** Why a scope or the agents are not supported, when the lists above are empty. */
  skillsNote?: string;
  agentsNote?: string;
}

const AGENTS_SHARED: AgentSink = { format: "claude-md", folder: ".claude/agents" };

/**
 * Where each tool looks, taken from the tools' own documentation on 2026-10-10 (see docs/AI-TOOLS.md).
 * `.agents/skills` is the shared folder most tools read. Claude Code reads only `.claude/skills`.
 */
const TOOLS: Readonly<Record<ToolId, ToolSpec>> = {
  claude: {
    label: "Claude Code",
    skills: { project: [".claude/skills"], user: [".claude/skills"] },
    agents: { project: [AGENTS_SHARED], user: [AGENTS_SHARED] },
  },
  opencode: {
    label: "OpenCode",
    skills: {
      project: [".agents/skills", ".claude/skills", ".opencode/skills"],
      user: [".agents/skills", ".claude/skills", ".config/opencode/skills"],
    },
    agents: {
      project: [{ format: "opencode-md", folder: ".opencode/agents" }],
      user: [{ format: "opencode-md", folder: ".config/opencode/agents" }],
    },
  },
  copilot: {
    label: "VS Code / GitHub Copilot",
    skills: {
      project: [".agents/skills", ".claude/skills", ".github/skills"],
      user: [".agents/skills", ".claude/skills", ".copilot/skills"],
    },
    agents: { project: [AGENTS_SHARED], user: [AGENTS_SHARED] },
  },
  codex: {
    label: "Codex",
    skills: { project: [".agents/skills"], user: [".agents/skills"] },
    agents: {
      project: [{ format: "codex-toml", folder: ".codex/agents" }],
      user: [{ format: "codex-toml", folder: ".codex/agents" }],
    },
  },
  cursor: {
    label: "Cursor",
    skills: {
      project: [".agents/skills", ".cursor/skills", ".claude/skills"],
      user: [".agents/skills", ".cursor/skills", ".claude/skills"],
    },
    agents: {
      project: [AGENTS_SHARED, { format: "claude-md", folder: ".cursor/agents" }],
      user: [AGENTS_SHARED, { format: "claude-md", folder: ".cursor/agents" }],
    },
  },
  gemini: {
    label: "Gemini CLI",
    skills: { project: [".agents/skills", ".gemini/skills"], user: [".agents/skills", ".gemini/skills"] },
    agents: {
      project: [{ format: "gemini-md", folder: ".gemini/agents" }],
      user: [{ format: "gemini-md", folder: ".gemini/agents" }],
    },
  },
  antigravity: {
    label: "Google Antigravity",
    skills: { project: [".agents/skills"], user: [] },
    agents: { project: [], user: [] },
    skillsNote: "Antigravity's global skills folder differs by product (IDE, CLI, 2.0), so install it per project.",
    agentsNote: "Antigravity has no subagent files; it gets the skills only.",
  },
};

export interface Unsupported {
  tool: ToolId;
  reason: string;
}

export interface SkillFolders {
  /** Relative folders to install into, in the order they were chosen. */
  folders: string[];
  /** The tools each folder serves. */
  serves: Map<string, ToolId[]>;
  unsupported: Unsupported[];
  /** Tools that read more than one chosen folder, so they will see each skill twice. */
  readsSeveral: ToolId[];
}

export interface AgentSinks {
  sinks: AgentSink[];
  unsupported: Unsupported[];
}

export function toolLabel(tool: ToolId): string {
  return TOOLS[tool].label;
}

/** Reads `--tool`: one tool, a comma-separated list, or `all`. */
export function parseToolList(value: string): ToolId[] {
  const supported = TOOL_IDS.join(", ");
  if (value === "all") return [...TOOL_IDS];
  const names = value.split(",").map((name) => name.trim());
  const unknown = names.filter((name) => !isToolId(name));
  if (unknown.length > 0) {
    const shown = unknown.filter((name) => name !== "").map((name) => JSON.stringify(name.slice(0, 40)));
    throw new EmdError("USAGE", `--tool expects ${supported}, a comma-separated list of them, or all${shown.length > 0 ? `, not ${shown.join(", ")}` : ""}.`);
  }
  return [...new Set(names as ToolId[])];
}

/**
 * Picks the fewest skill folders that every selected tool reads, so a skill is not installed twice
 * where one copy would do. Tools with only one choice go first and the others join a folder that
 * is already chosen when they can read it.
 */
export function chooseSkillFolders(tools: readonly ToolId[], scope: Scope): SkillFolders {
  const unsupported: Unsupported[] = [];
  const candidates: Array<{ tool: ToolId; options: readonly string[] }> = [];
  for (const tool of tools) {
    const options = TOOLS[tool].skills[scope];
    if (options.length === 0) unsupported.push({ tool, reason: TOOLS[tool].skillsNote ?? "No skills folder is known." });
    else candidates.push({ tool, options });
  }

  const folders: string[] = [];
  const serves = new Map<string, ToolId[]>();
  for (const { tool, options } of [...candidates].sort((a, b) => a.options.length - b.options.length)) {
    let folder = options.find((option) => folders.includes(option));
    if (folder === undefined) {
      folder = options[0] as string;
      folders.push(folder);
    }
    serves.set(folder, [...(serves.get(folder) ?? []), tool]);
  }
  const readsSeveral = tools.filter((tool) => TOOLS[tool].skills[scope].filter((folder) => folders.includes(folder)).length > 1);
  return { folders, serves, unsupported, readsSeveral };
}

/** Like the skill folders, but a folder is shared only when the agent file format is the same too. */
export function chooseAgentSinks(tools: readonly ToolId[], scope: Scope): AgentSinks {
  const unsupported: Unsupported[] = [];
  const candidates: Array<{ options: readonly AgentSink[] }> = [];
  for (const tool of tools) {
    const options = TOOLS[tool].agents[scope];
    if (options.length === 0) unsupported.push({ tool, reason: TOOLS[tool].agentsNote ?? "This tool has no subagent files." });
    else candidates.push({ options });
  }

  const sinks: AgentSink[] = [];
  for (const { options } of [...candidates].sort((a, b) => a.options.length - b.options.length)) {
    const covered = options.some((option) => sinks.some((sink) => sameSink(sink, option)));
    if (!covered) sinks.push(options[0] as AgentSink);
  }
  return { sinks, unsupported };
}

/** Every skill folder any of the tools reads, for finding what EMD installed earlier. */
export function allSkillFolders(tools: readonly ToolId[], scope: Scope): string[] {
  return [...new Set(tools.flatMap((tool) => TOOLS[tool].skills[scope]))];
}

/** Every agent folder any of the tools reads, for finding what EMD installed earlier. */
export function allAgentFolders(tools: readonly ToolId[], scope: Scope): string[] {
  return [...new Set(tools.flatMap((tool) => TOOLS[tool].agents[scope].map((sink) => sink.folder)))];
}

function sameSink(a: AgentSink, b: AgentSink): boolean {
  return a.format === b.format && a.folder === b.folder;
}

function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}
