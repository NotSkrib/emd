# How EMD installs into AI tools

`emd install` puts EMD's skills and subagents where each AI tool reads them. This page records what each tool's own documentation said on 2026-10-10, so the table in `src/install/tools.ts` can be checked and updated. Tools change these paths. Re-read the linked page before changing a row.

## Skills

A skill is a folder with a `SKILL.md` file, following the [Agent Skills specification](https://agentskills.io/specification): `name` (up to 64 characters, lowercase letters, digits and single hyphens, equal to the folder name) and `description` (up to 1024 characters). EMD's skills use only `name`, `description` and `license`, and every name starts with `emd-`.

| Tool | Project folders it reads | User folders it reads | Source |
|---|---|---|---|
| Claude Code | `.claude/skills` | `~/.claude/skills` | [Skills](https://code.claude.com/docs/en/skills) |
| OpenCode | `.agents/skills`, `.claude/skills`, `.opencode/skills` | `~/.agents/skills`, `~/.claude/skills`, `~/.config/opencode/skills` | [Skills](https://opencode.ai/docs/skills) |
| VS Code / GitHub Copilot | `.github/skills`, `.claude/skills`, `.agents/skills` | `~/.copilot/skills`, `~/.claude/skills`, `~/.agents/skills` | [Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |
| Codex | `.agents/skills` | `~/.agents/skills` | [Build skills](https://learn.chatgpt.com/docs/build-skills) |
| Cursor | `.agents/skills`, `.cursor/skills`, also `.claude/skills` and `.codex/skills` | `~/.agents/skills`, `~/.cursor/skills`, also the Claude and Codex ones | [Skills](https://cursor.com/docs/context/skills) |
| Gemini CLI | `.gemini/skills` or the alias `.agents/skills` | `~/.gemini/skills` or `~/.agents/skills` | [Agent Skills](https://geminicli.com/docs/cli/skills/) |
| Google Antigravity | `.agents/skills` | differs by product (`~/.gemini/config/skills`, `~/.gemini/antigravity-cli/skills`) | [Codelab](https://codelabs.developers.google.com/getting-started-with-antigravity-skills) |

Claude Code is the only one of these that does not read `.agents/skills`, so a skill for Claude Code and any other tool lives in two folders. EMD installs into the fewest folders that cover the tools you pick, and tells you when a tool reads both and may list a skill twice. EMD does not install Antigravity skills at user level, because its global folder is not the same across its products.

## Subagents

Subagents differ by tool, so EMD writes the same agent in up to four formats.

| Tool | Folder | Format | Notes | Source |
|---|---|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | Markdown with `name`, `description` | Ignores fields it does not know. EMD adds `disallowedTools` to read-only agents. | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| VS Code / GitHub Copilot | `.claude/agents/*.md` (Claude format) or `.github/agents/*.agent.md` | as Claude Code | EMD uses the shared `.claude/agents` folder. | [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) |
| Cursor | `.cursor/agents`, `.claude/agents`, `.codex/agents` | Markdown with `name`, `description`, `model`, `readonly`, `is_background` | EMD uses `.claude/agents` and adds `readonly: true` to read-only agents. | [Subagents](https://cursor.com/docs/context/subagents) |
| OpenCode | `.opencode/agents/<name>.md` (plural) | Markdown with `description`, `mode: subagent`, `permission` | The file name is the agent name. Unknown header keys may be passed to the model as options, so EMD writes none. | [Agents](https://opencode.ai/docs/agents) |
| Codex | `.codex/agents/<name>.toml` | TOML with `name`, `description`, `developer_instructions` | EMD writes the instructions as a literal multi-line string. | [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) |
| Gemini CLI | `.gemini/agents/<name>.md` | Markdown with `name`, `description` | EMD sets no `tools`, so the agent inherits the parent's. | [Subagents](https://geminicli.com/docs/core/subagents/) |
| Google Antigravity | none documented | | It gets the skills only. | |

## Ownership

Every file EMD writes ends with `<!-- emd-managed VERSION -->` (a `# emd-managed VERSION` line in TOML). The marker is in the body, never the header. EMD replaces or deletes a file only when it carries the marker, and it refuses to overwrite anything else. It never follows a link and never touches a name that does not start with `emd-`.

## Checking a row

1. Open the linked page and compare the folders and fields.
2. Change `src/install/tools.ts` and the matching row above, and add a test if the rule is new.
3. Run `npm test`. The shipped-content tests check that every skill and agent still converts for every tool.
