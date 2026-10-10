# EMD: Everything Minecraft Development

One toolkit for building Minecraft plugins, mods and packs with an AI agent.

- **Live version data.** Minecraft, Java, Paper, Folia, Velocity, Fabric, NeoForge and Forge versions come from their official APIs, not from a table that goes stale.
- **Presets proven on real projects.** Each preset records which open-source project it came from, and a nightly workflow generates every preset and builds it against the newest release.
- **Skills and subagents** for Claude Code, OpenCode, VS Code Copilot, Antigravity, Codex, Cursor and Gemini CLI. `emd install` puts them where each tool reads them, so the tool uses `emd` instead of guessing versions.

Status: early development. The live version resolver, six presets and the installer work. The presets are a Paper plugin, a Velocity plugin, a Fabric mod, a NeoForge mod, a data pack and a resource pack. All are unit tested, and the `presets` workflow generates each one against the newest Minecraft release on every change and every night. The four with a build are built with Gradle. The two packs have none, so their `pack.mcmeta` is checked instead. Nothing has booted a server or client yet, and the skills have not been tried inside each AI tool. It is published to npm as `emd-minecraft`.

## Quick start

You need Node 22 or newer. Nothing to install first:

```bash
npx emd-minecraft install --tool claude        # give your AI tool the EMD skills (see below for other tools)
npx emd-minecraft versions --mc 26.3           # Java, Paper, Folia, Fabric, NeoForge and Forge for one release
npx emd-minecraft preset list                  # the project layouts EMD can create
```

The command is also called `emd`. After `npm install -g emd-minecraft` you can type `emd` instead of `npx emd-minecraft`, and the examples below use `emd`.

## Live versions

```bash
emd versions                # newest Minecraft release each platform supports
emd versions --mc 26.3      # Java, Paper, Folia, Fabric, NeoForge and Forge for one release
emd versions --mc 26.3 --json
```

`emd versions --mc 26.3` prints, from the live APIs:

```
Minecraft 26.3  (Java 25, from Mojang)

  Paper     paper-api:26.3.build.+
  Folia     not available (newest: 26.2)
  Fabric    loader 0.19.5, API 0.162.0+26.3, Loom 1.18.3 (net.fabricmc.fabric-loom)
  NeoForge  26.3.0.64-beta (beta)
```

It warns when a platform trails the newest Minecraft release, as Folia does here. Responses are cached privately in `~/.emd/cache` for an hour, and `--refresh` skips the cache. If the network is down, a cached copy up to seven days old is used and the output says so.

## Create a project

A preset is a proven project layout. `emd new` fills it in with the live versions for the Minecraft release you pick:

```bash
emd preset list
emd preset show paper-plugin-gradle
emd new --preset paper-plugin-gradle --mc 26.3 \
  --set name=MyPlugin --set package=dev.example.myplugin --set author=YourName
```

`--mc latest` means the newest Minecraft release.

A proxy plugin is not tied to one Minecraft release, so `--mc` is optional for it, and its Java version comes from the Velocity API itself:

```bash
emd new --preset velocity-plugin \
  --set name=MyProxyPlugin --set pluginId=my_proxy_plugin --set package=dev.example.myproxyplugin --set author=YourName
```

Add `--dry-run` to see the files first, or `--json` for output a script or an AI agent can read. It never overwrites existing files unless you pass `--force`. Free-text answers such as the description are escaped for each file they land in, and every generated project gets its own `AGENTS.md` with the exact build and run commands.

Data for Minecraft versions older than 1.20.5 is incomplete, because platforms publish those under older artifact names. `emd versions` says so when you ask for one.

## Use it from your AI tool

`emd install` copies EMD's skills and subagents into the folders your AI tools read:

```bash
emd install --tool claude                # Claude Code, in the current project
emd install --tool claude,codex,cursor   # several tools at once
emd install --tool all --scope user      # every tool, for your whole account
emd install --tool all --dry-run         # show what would change
emd status                               # what is installed, and whether it is current
emd uninstall                            # remove what EMD installed
```

The tools are `claude`, `opencode`, `copilot` (VS Code), `codex`, `cursor`, `gemini` and `antigravity`. Skills go into the fewest folders that cover your choice (`.agents/skills`, which most tools read, plus `.claude/skills` for Claude Code), and subagents are written in each tool's own format. Antigravity gets skills only, and only per project.

| Skill or agent | What it does |
|---|---|
| `emd-minecraft-dev` | The workflow: pick a preset, generate with live versions, build, report honestly. |
| `emd-version-facts` | What changed recently and what models usually get wrong about it. |
| `emd-packs` | `pack.mcmeta`, folder names and functions for data packs and resource packs. |
| `emd-build-troubleshooting` | Gradle and toolchain errors, with their causes. |
| `emd-builder` (agent) | Creates a project end to end and builds it. |
| `emd-reviewer` (agent, read-only) | Reviews changes for stale versions and metadata. |

EMD only changes files that carry its marker and names that start with `emd-`. It stops without writing anything if it would overwrite something else. How each tool's folders were found is in [docs/AI-TOOLS.md](docs/AI-TOOLS.md).

## Slash commands in Claude Code

EMD is also a Claude Code plugin, which gives you `/emd:` commands. Inside Claude Code:

```text
/plugin marketplace add NotSkrib/emd
/plugin install emd@emd
```

| Command | What it does |
|---|---|
| `/emd:plan <what you want to build>` | Plans the project (platform, preset, live versions, inputs, risks) and waits for your OK before creating anything. |
| `/emd:new <what you want to build>` | Creates the project from a preset and builds it, through the `emd-builder` agent. |
| `/emd:versions [version]` | Shows live Minecraft, Java and platform versions. |
| `/emd:review` | Reviews your changes for stale versions and bad pack metadata. Read-only. |
| `/emd:fix-build` | Diagnoses a failing Gradle build, one change at a time. |

The plugin also loads the skills and agents, so you do not need `emd install` for Claude Code. The commands run `emd` (as `npx emd-minecraft` when it is not installed), so Node 22 or newer is required. The plugin passes Claude Code's own `claude plugin validate`, but has not been run in a real session yet. Slash commands for the other tools are not built yet. They get the skills and agents through `emd install`.

## Platforms

| Family | Supported today (a preset exists) | Planned |
|---|---|---|
| Plugins | Paper, Folia (a flag in the Paper preset) | Spigot/Bukkit, Purpur |
| Proxies | Velocity | BungeeCord |
| Mods | Fabric, NeoForge | Forge, Quilt |
| Packs | Data packs, resource packs (1.21.9 and newer) | older versions, Bedrock add-ons |

`emd versions` already reports Forge and Velocity data. Only the platforms in the middle column have presets.

## Develop

From a clone of this repository, run the built copy with `node dist/cli.js <command>` instead of `emd`:

```bash
npm ci
npm test
npm run build
npm run prove    # generate every preset and build it with Gradle (JDK 25 and a current Gradle)
```

The `presets` workflow does the same on GitHub for every change to a preset and once a night, because Minecraft tooling moves without any commit here.

## License

MIT. The presets are derived from other open-source projects, listed with their licenses in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
