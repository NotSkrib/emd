# EMD: Everything Minecraft Development

One toolkit for building Minecraft plugins, mods and packs with an AI agent.

- **Live version data.** Minecraft, Java, Paper, Folia, Velocity, Fabric, NeoForge and Forge versions come from their official APIs, not from a table that goes stale.
- **Presets proven on real projects.** Planned. Each preset records which open-source project it came from and is rebuilt against the newest release in CI.
- **Skills and subagents** for Claude Code, OpenCode, VS Code Copilot, Antigravity, Codex, Cursor and Gemini CLI. Planned.

Status: early development. The live version resolver and three presets (a Paper plugin, a Velocity plugin and a Fabric mod) work. All are unit tested, and each has been built by hand with real Gradle (9.5.1 and 9.8.1, Minecraft 26.3); no CI job does that yet, and nothing has booted a server or client. Skills and the installer are not built yet, and nothing is published to npm.

## Try it

From a clone of this repository:

```bash
npm ci
npm run build
node dist/cli.js versions                # newest Minecraft release each platform supports
node dist/cli.js versions --mc 26.3      # Java, Paper, Folia, Fabric, NeoForge and Forge for one release
node dist/cli.js versions --mc 26.3 --json
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
node dist/cli.js preset list
node dist/cli.js preset show paper-plugin-gradle
node dist/cli.js new --preset paper-plugin-gradle --mc 26.3 \
  --set name=MyPlugin --set package=dev.example.myplugin --set author=YourName
```

`--mc latest` means the newest Minecraft release.

A proxy plugin is not tied to one Minecraft release, so `--mc` is optional for it, and its Java version comes from the Velocity API itself:

```bash
node dist/cli.js new --preset velocity-plugin \
  --set name=MyProxyPlugin --set pluginId=my_proxy_plugin --set package=dev.example.myproxyplugin --set author=YourName
```

Add `--dry-run` to see the files first, or `--json` for output a script or an AI agent can read. It never overwrites existing files unless you pass `--force`. Free-text answers such as the description are escaped for each file they land in, and every generated project gets its own `AGENTS.md` with the exact build and run commands.

Data for Minecraft versions older than 1.20.5 is incomplete, because platforms publish those under older artifact names. `emd versions` says so when you ask for one.

## Target platforms

| Family | Platforms |
|---|---|
| Plugins | Spigot/Bukkit, Paper, Folia, Purpur |
| Proxies | Velocity, BungeeCord |
| Mods | Fabric, NeoForge, Forge, Quilt |
| Packs | Resource packs, data packs |

## Develop

```bash
npm ci
npm test
npm run build
npm run prove    # generate every preset and build it with Gradle (JDK 25 and a current Gradle)
```

The `presets` workflow does the same on GitHub for every change to a preset and once a night, because Minecraft tooling moves without any commit here.

## License

MIT. The presets are derived from other open-source projects, listed with their licenses in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
