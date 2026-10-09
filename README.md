# EMD: Everything Minecraft Development

One toolkit for building Minecraft plugins, mods and packs with an AI agent.

- **Live version data.** Minecraft, Java, Paper, Folia, Velocity, Fabric, NeoForge and Forge versions come from their official APIs, not from a table that goes stale.
- **Presets proven on real projects.** Planned. Each preset records which open-source project it came from and is rebuilt against the newest release in CI.
- **Skills and subagents** for Claude Code, OpenCode, VS Code Copilot, Antigravity, Codex, Cursor and Gemini CLI. Planned.

Status: early development. The live version resolver works. Presets, skills and the installer are not built yet, and nothing is published to npm.

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
```

## License

MIT
