import { EmdError } from "../errors.js";
import type { Agent, Command, Skill, SkillFile } from "./content.js";
import { serializeFrontmatter } from "./frontmatter.js";
import type { AgentFormat, CommandFormat } from "./tools.js";

const MARKER_LINE = /^(?:<!-- emd-managed (\S+) -->|# emd-managed (\S+))\s*$/m;
const CLAUDE_READONLY_DENY = "Write, Edit, NotebookEdit";
/** The folder that gives Gemini CLI commands the `emd:` prefix. */
export const COMMAND_NAMESPACE = "emd";
const ARGUMENTS_PLACEHOLDER = "$ARGUMENTS";
/** How the Claude Code plugin's commands name each other, as in `/emd:plan`. */
const COMMAND_REFERENCE = /\/emd:([a-z][a-z0-9-]*)/g;
/** Gemini CLI runs `!{...}`, inlines `@{...}` and fills `{{...}}` in a command's prompt. */
const GEMINI_SPECIAL = /!\{|@\{|\{\{/;
/** OpenCode runs a backticked command after `!` and inlines a file after `@` at the start of a word. */
const OPENCODE_SHELL = /!`/;
const OPENCODE_FILE = /(?:^|[\s(\[])@[\w.~/\\-]/;

export interface EmittedFile {
  fileName: string;
  content: string;
}

export interface EmittedCommand {
  /** Relative to the tool's commands folder, with forward slashes. */
  relativePath: string;
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

/**
 * A slash command in a tool's own format. Both tools act on special syntax inside the prompt, so a
 * body that contains any is refused instead of shipped: it could run a shell command or read a file.
 */
export function emitCommand(command: Command, format: CommandFormat, version: string): EmittedCommand {
  switch (format) {
    case "gemini-toml":
      return { relativePath: `${COMMAND_NAMESPACE}/${command.name}.toml`, content: geminiCommand(command, version) };
    case "opencode-md":
      return { relativePath: `emd-${command.name}.md`, content: opencodeCommand(command, version) };
  }
}

function geminiCommand(command: Command, version: string): string {
  const label = `command ${command.name}`;
  assertTomlLiteral(command.body, label);
  if (GEMINI_SPECIAL.test(command.body)) throw new EmdError("BAD_CONTENT", `${label}: the prompt contains !{, @{ or {{, which Gemini CLI would act on.`);
  const prompt = command.body.replaceAll(ARGUMENTS_PLACEHOLDER, "{{args}}");
  return [
    `description = ${JSON.stringify(command.description)}`,
    `prompt = '''\n${prompt.endsWith("\n") ? prompt : `${prompt}\n`}'''`,
    "",
    `# emd-managed ${version}`,
    "",
  ].join("\n");
}

function opencodeCommand(command: Command, version: string): string {
  const label = `command ${command.name}`;
  if (OPENCODE_SHELL.test(command.body)) throw new EmdError("BAD_CONTENT", `${label}: the prompt contains !\`, which OpenCode would run as a shell command.`);
  if (OPENCODE_FILE.test(command.body)) throw new EmdError("BAD_CONTENT", `${label}: the prompt contains an @ file reference, which OpenCode would read.`);
  const prompt = command.body.replace(COMMAND_REFERENCE, "/emd-$1");
  return withMarker(serializeFrontmatter([["description", command.description]]) + prompt, version);
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

/** A TOML literal string cannot hold `'''` or most control characters. */
function assertTomlLiteral(text: string, label: string): void {
  if (text.includes("'''")) throw new EmdError("BAD_CONTENT", `${label}: the text contains ''', which would end the TOML string.`);
  if (hasForbiddenTomlCharacter(text)) throw new EmdError("BAD_CONTENT", `${label}: the text contains a control character TOML does not allow.`);
}

function codexToml(agent: Agent, version: string): string {
  assertTomlLiteral(agent.body, agent.name);
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
