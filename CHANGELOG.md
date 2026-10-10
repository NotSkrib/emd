# Changelog

## 0.1.1 (2026-10-10)

Added

- Five skills: `emd-preset-guide`, `emd-upgrade-minecraft`, `emd-folia-threading`, `emd-local-testing` and `emd-release-checklist`. The Folia skill was checked against the Paper documentation.
- Three subagents: `emd-planner` and `emd-doctor` (both read-only) and `emd-upgrader`.
- Five slash commands for the Claude Code plugin: `/emd:upgrade`, `/emd:doctor`, `/emd:release`, `/emd:presets` and `/emd:test`.
- `emd install` now writes slash commands for Gemini CLI (`.gemini/commands/emd/<name>.toml`, run as `/emd:<name>`) and OpenCode (`.opencode/commands/emd-<name>.md`, run as `/emd-<name>`). For Copilot, Cursor and Codex it says to use the skills as commands, because those tools do not need command files. EMD refuses a command whose text contains syntax Gemini CLI or OpenCode would execute.
- `emd status` lists installed commands.

Fixed

- `emd versions --mc latest` is accepted. `emd new --mc latest` already was.
- The npm package now contains the `commands/` folder, which the installer reads.

## 0.1.0 (2026-10-10)

First release: live version resolver, six presets (Paper, Velocity, Fabric, NeoForge, data pack, resource pack), `emd install` for seven AI tools, four skills, two subagents and the Claude Code plugin.
