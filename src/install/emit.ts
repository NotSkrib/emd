import { EmdError } from "../errors.js";
import type { Agent, Skill, SkillFile } from "./content.js";
import { serializeFrontmatter } from "./frontmatter.js";
import type { AgentFormat } from "./tools.js";

const MARKER_LINE = /^(?:<!-- emd-managed (\S+) -->|# emd-managed (\S+))\s*$/m;
const CLAUDE_READONLY_DENY = "Write, Edit, NotebookEdit";

export interface EmittedFile {
  fileName: string;
  content: string;
}

/**
 * The version in the ownership marker EMD puts at the end of every file it installs, or undefined
 * for a file it did not write. The marker lives in the body or a comment and never in the header:
 * OpenCode passes unknown header keys on to the model as options.
 */
export function managedVersion(content: string): string | undefined {
  const match = MARKER_LINE.exec(content);
  return match?.[1] ?? match?.[2];
}

/** The skill's files as they are installed: `SKILL.md` gets the marker, the others are copied as they are. */
export function emitSkillFiles(skill: Skill, version: string): SkillFile[] {
  return skill.files.map((file) => (file.path === "SKILL.md" ? { path: file.path, content: withMarker(file.content, version) } : file));
}

export function emitAgent(agent: Agent, format: AgentFormat, version: string): EmittedFile {
  switch (format) {
    case "claude-md":
      return { fileName: `${agent.name}.md`, content: withMarker(claudeHeader(agent) + agent.body, version) };
    case "opencode-md":
      return { fileName: `${agent.name}.md`, content: withMarker(opencodeHeader(agent) + agent.body, version) };
    case "gemini-md":
      return { fileName: `${agent.name}.md`, content: withMarker(serializeFrontmatter([["name", agent.name], ["description", agent.description]]) + agent.body, version) };
    case "codex-toml":
      return { fileName: `${agent.name}.toml`, content: codexToml(agent, version) };
  }
}

function claudeHeader(agent: Agent): string {
  const entries: Array<[string, string | boolean]> = [["name", agent.name], ["description", agent.description]];
  // Cursor reads readonly; Claude Code ignores it and honours disallowedTools; VS Code reads the same folder.
  if (agent.readonly) entries.push(["readonly", true], ["disallowedTools", CLAUDE_READONLY_DENY]);
  return serializeFrontmatter(entries);
}

function opencodeHeader(agent: Agent): string {
  const raw = ["mode: subagent", ...(agent.readonly ? ["permission:", "  edit: deny"] : [])];
  return serializeFrontmatter([["description", agent.description]], raw);
}

function codexToml(agent: Agent, version: string): string {
  if (agent.body.includes("'''")) throw new EmdError("BAD_CONTENT", `${agent.name}: the instructions contain ''', which would end the TOML string.`);
  if (hasForbiddenTomlCharacter(agent.body)) throw new EmdError("BAD_CONTENT", `${agent.name}: the instructions contain a control character TOML does not allow.`);
  const body = agent.body.endsWith("\n") ? agent.body : `${agent.body}\n`;
  return [
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${JSON.stringify(agent.description)}`,
    `developer_instructions = '''\n${body}'''`,
    "",
    `# emd-managed ${version}`,
    "",
  ].join("\n");
}

/** TOML literal strings allow tab and line breaks but no other control character. */
function hasForbiddenTomlCharacter(text: string): boolean {
  return Array.from(text).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
  });
}

function withMarker(content: string, version: string): string {
  const text = content.endsWith("\n") ? content : `${content}\n`;
  return `${text}\n<!-- emd-managed ${version} -->\n`;
}
