# EMD: Everything Minecraft Development

One toolkit for building Minecraft plugins, mods and packs with an AI agent.

- **Live version data.** Minecraft, Java, Paper, Folia, Velocity, Fabric, NeoForge and Forge versions come from their official APIs, not from a table that goes stale.
- **Presets proven on real projects.** Each preset records which open-source project it came from, and a nightly workflow generates every preset and builds it against the newest release.
- **Skills and subagents** for Claude Code, OpenCode, VS Code Copilot, Antigravity, Codex, Cursor and Gemini CLI. `emd install` puts them where each tool reads them, so the tool uses `emd` instead of guessing versions.

Status: early development. The live version resolver, six presets and the installer work. The presets are a Paper plugin, a Velocity plugin, a Fabric mod, a NeoForge mod, a data pack and a resource pack. All are unit tested, and the `presets` workflow generates each one against the newest Minecraft release on every change and every night. The four with a build are built with Gradle. The two packs have none, so their `pack.mcmeta` is checked instead. Nothing has booted a server or client yet, and the skills have not been tried inside each AI tool. It is published to npm as `emd-minecraft`.

## How to use it

EMD works inside your AI tool. You ask for a Minecraft plugin, mod or pack in plain words. The tool uses EMD to pick a proven project layout, fills in the current versions, builds the project, and tells you what it checked and what it did not.

### 1. Install it once

**Claude Code.** In a Claude Code session:

```text
/plugin marketplace add NotSkrib/emd
/plugin install emd@emd
```

Or from a terminal:

```bash
claude plugin marketplace add NotSkrib/emd
claude plugin install emd@emd
```

Start a new session afterwards. Type `/emd:` and the ten commands are listed. The plugin also loads the EMD skills and agents, so Claude Code needs nothing else.

**Other tools.** Run the installer from your project folder, or add `--scope user` to install for every project:

| Tool | Install | Then |
|---|---|---|
| Gemini CLI | `npx emd-minecraft install --tool gemini` | `/emd:new` |
| OpenCode | `npx emd-minecraft install --tool opencode` | `/emd-new` |
| VS Code Copilot, Cursor | `npx emd-minecraft install --tool copilot,cursor` | Type `/` and pick an EMD skill |
| Codex | `npx emd-minecraft install --tool codex` | Mention a skill with `$`, or open `/skills` |

You also need Node 22 or newer, because the commands run `emd` through `npx`. To build a project you need the JDK and Gradle it names. `/emd:doctor` checks both for you.

### 2. Build something

These three commands take you from an idea to a built project. Replace the description with your own.

```text
/emd:presets a Paper plugin
```

Lists the project layouts EMD has and recommends one. It creates nothing.

```text
/emd:plan a Paper plugin called HelloJoin that greets players when they join
```

Reports the preset, the live versions (Java, Paper build, any warnings), the inputs it still needs from you, and the risks. It creates nothing and waits for your answer. Say yes, or change something.

```text
/emd:new a Paper plugin called HelloJoin that greets players when they join
```

Asks for anything it needs, such as the Java package and your author name. It does not make those up. Then it creates the folder, runs the build, and reports the versions it used, the commands it ran, and what it did not prove. A Gradle build proves the project compiles. It does not prove the plugin works in the game, and the report says "built, not run" unless the game or a server was started.

Open the new folder. Its `README.md` and `AGENTS.md` list the exact build and run commands for that project.

### 3. Keep going

| You want to | Use |
|---|---|
| Fix a build that fails | `/emd:fix-build` and paste the error |
| Find out why Java or Gradle will not work | `/emd:doctor` |
| Move a project to a newer Minecraft | `/emd:upgrade 26.3` |
| Look up current versions | `/emd:versions 26.3` |
| Check your changes for stale versions and bad pack metadata | `/emd:review` |
| Start the test server or client and see what happens | `/emd:test` |
| Check a jar or pack before you share it | `/emd:release` |

The full list is under [Slash commands in Claude Code](#slash-commands-in-claude-code).

### 4. Or just ask

The skills load on their own, so a plain request also works: "make me a Fabric mod for the newest Minecraft". The commands are shortcuts that make each step explicit.

### What EMD will not do

- It does not accept the Minecraft EULA for you. If a server stops and asks, you accept it yourself.
- It does not upload to a download site, sign in anywhere, tag a release or push your code unless you ask.
- It does not write a Minecraft, Java, Paper, Fabric, NeoForge or Gradle-plugin version from memory. It reads them from the official APIs with `emd versions`.
- It does not overwrite files in an existing folder unless you pass `--force`.

### Update, remove, or try it without installing

```bash
claude plugin update emd@emd                          # update the Claude Code plugin
claude plugin uninstall emd@emd                       # remove it
claude --plugin-dir path/to/this/repo                 # try it from a clone, for one session
npx emd-minecraft@latest install --tool gemini        # update the other tools' files
npx emd-minecraft status                              # what is installed, and whether it is current
npx emd-minecraft uninstall                           # remove what the installer wrote
```

The sections below are reference. They cover every command and option.

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

`emd install` copies EMD's skills, subagents and slash commands into the folders your AI tools read:

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
| `emd-preset-guide` | What each preset makes, where its descriptor and run tasks are, and its rules. |
| `emd-upgrade-minecraft` | Moving a project to a newer Minecraft version, and where the formats changed. |
| `emd-folia-threading` | The four Folia schedulers and what `folia-supported` promises. |
| `emd-forge-basics` | How a Forge 26.x mod is built (ForgeGradle 7, the dependency form, the mod class, `mods.toml`), checked with a real build. |
| `emd-local-testing` | Starting the test server, proxy or client, and reporting the run honestly. |
| `emd-release-checklist` | What to check in the jar or pack before it is shared. |
| `emd-builder` (agent) | Creates a project end to end and builds it. |
| `emd-planner` (agent, read-only) | Plans a project (preset, live versions, inputs, risks) and writes nothing. |
| `emd-upgrader` (agent) | Upgrades a project by comparing it with a fresh one, then rebuilds. |
| `emd-doctor` (agent, read-only) | Checks that Java, Gradle and Node fit the project. |
| `emd-reviewer` (agent, read-only) | Reviews changes for stale versions and metadata. |

EMD only changes files that carry its marker and names that start with `emd-`. It stops without writing anything if it would overwrite something else. How each tool's folders were found is in [docs/AI-TOOLS.md](docs/AI-TOOLS.md).

## Slash commands in Claude Code

EMD is also a Claude Code plugin, which gives you `/emd:` commands. Install it with the two lines under [How to use it](#how-to-use-it).

| Command | What it does |
|---|---|
| `/emd:plan <what you want to build>` | Plans the project (platform, preset, live versions, inputs, risks) and waits for your OK before creating anything. |
| `/emd:new <what you want to build>` | Creates the project from a preset and builds it, through the `emd-builder` agent. |
| `/emd:versions [version]` | Shows live Minecraft, Java and platform versions. |
| `/emd:review` | Reviews your changes for stale versions and bad pack metadata. Read-only. |
| `/emd:fix-build` | Diagnoses a failing Gradle build, one change at a time. |
| `/emd:upgrade [version]` | Upgrades a project to a newer Minecraft version by comparing it with a fresh one. |
| `/emd:doctor` | Checks that the Java, Gradle and Node on this machine fit the project. Read-only. |
| `/emd:release` | Runs the release checklist on a jar or pack folder. Uploads nothing. |
| `/emd:presets [what you want]` | Explains the presets and recommends one. |
| `/emd:test [task]` | Runs the project's test server, proxy or client and reports what happened. |

The plugin also loads the skills and agents, so you do not need `emd install` for Claude Code. The commands run `emd` (as `npx emd-minecraft` when it is not installed), so Node 22 or newer is required. The plugin passes Claude Code's own `claude plugin validate`, but has not been run in a real session yet.

### Slash commands in other tools

The same ten commands, in each tool's own way. `emd install` writes the command files for the tools that have them:

| Tool | How you run `new` | Where it comes from |
|---|---|---|
| Claude Code | `/emd:new` | The plugin above |
| Gemini CLI | `/emd:new` | `emd install --tool gemini` writes `.gemini/commands/emd/*.toml` |
| OpenCode | `/emd-new` | `emd install --tool opencode` writes `.opencode/commands/emd-*.md` |
| VS Code Copilot, Cursor | type `/` and pick an EMD skill | The skills. Both tools list skills as slash commands, so EMD adds no command files. |
| Codex | mention a skill with `$`, or open `/skills` | The skills. |
| Antigravity | none documented | It gets the skills only. |

EMD refuses to install a command whose text contains syntax that Gemini CLI or OpenCode would execute, such as `!{...}` or a backticked shell command after `!`. These commands are the plugin's files, converted for each tool. They have been parsed and installed in tests, but not run in a real Gemini CLI or OpenCode session yet.

## Platforms

| Family | Supported today (a preset exists) | Planned |
|---|---|---|
| Plugins | Paper, Folia (a flag in the Paper preset) | Spigot/Bukkit, Purpur |
| Proxies | Velocity | none. BungeeCord is blocked, see below. |
| Mods | Fabric, NeoForge | none. Forge has a skill but no preset, and Quilt is blocked, see below. |
| Packs | Data packs, resource packs (1.21.9 and newer) | older versions, Bedrock add-ons |

`emd versions` already reports Forge and Velocity data. Only the platforms in the middle column have presets.

**Why there is no Forge preset.** Presets may copy only from MIT, Apache-2.0, CC0, BSD, ISC, 0BSD and Unlicense projects. Forge's MDK is under the LGPL 2.1, and its examples repository has no license, so neither can be copied. The `emd-forge-basics` skill gives AI tools the build facts instead, taken from a mod written from scratch and built with Gradle. A Forge preset would need either a permissively licensed template or a decision to relax that rule.

**Two more platforms that are blocked, checked 2026-10-10.**

- **Quilt.** Its template is CC0, but it targets Minecraft 1.20.6, and Quilt's standard libraries and Quilted Fabric API on the Quilt Maven stop at 1.21.1. There is nothing to build a 26.x preset on.
- **BungeeCord.** Its license is a BSD license with an extra clause that bars use for commercial software hosting services. That is not on the permissive list. Its API's newest release on Maven Central is also for 1.21, not 26.x.

Plain Spigot and Bukkit, and Purpur, have not been looked at. The Paper preset builds against Paper's API, so use it only for servers that run Paper.

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
