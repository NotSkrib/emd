---
name: emd-minecraft-dev
description: "Use when creating, changing or debugging anything for Minecraft: a Paper or Folia plugin, a Velocity proxy plugin, a Fabric or NeoForge mod, a data pack or a resource pack. Starts every project from a proven preset with the emd command and reads versions from live sources instead of guessing them. Triggers on: new Minecraft plugin, mod, data pack or resource pack, Minecraft version, Java version for Minecraft, Gradle build for Minecraft."
license: MIT
---
# Minecraft development with EMD

Minecraft tooling changes faster than a model's training data. Version numbers, dependency coordinates and pack metadata written from memory are often wrong, and the build then fails or, worse, the project loads and silently does nothing.

**The rule: never write a Minecraft, Java, Paper, Fabric, NeoForge, Velocity, Loom, Gradle-plugin or pack-format version from memory. Ask `emd`.**

`emd` is a command line tool. If it is not on the PATH, run it as `npx emd-minecraft <arguments>`.

## Start a new project

1. See what exists: `emd preset list`. Each preset is a project layout taken from a proven open-source project, filled in with live versions.
2. See what a preset asks for: `emd preset show <id>`. It lists every input with an example or default.
3. Get the answers you still need from the user: the project name, the Java package, the author. Do not invent an author or a package. A package such as `dev.example` is a placeholder, not an answer.
4. Preview: `emd new --preset <id> --mc latest --set name=... --set package=... --dry-run`. Use a specific `--mc` only if the user needs that version. A proxy preset takes no `--mc`.
5. Create it: run the same command without `--dry-run`. Read the warnings it prints and pass them on.
6. Read the generated `AGENTS.md` and `README.md`. They hold that project's commands and rules and override anything you assume.
7. Build it to prove it works, with the command in the generated `README.md` (usually `gradle build`). A data pack or resource pack has no build; load it in the game instead.
8. Tell the user what was generated, what you ran, and what you did not run. Do not say a plugin or mod works in the game unless you started the game or a server and saw it load.

## Presets

| Preset | Makes | Minecraft |
|---|---|---|
| `paper-plugin-gradle` | Paper plugin (can declare Folia support), Gradle Kotlin DSL, Java | 1.20.5 and newer |
| `velocity-plugin` | Velocity proxy plugin, Gradle Kotlin DSL, Java | not tied to one version |
| `fabric-mod` | Fabric mod, Gradle Groovy, unobfuscated Minecraft | 26.1 and newer |
| `neoforge-mod` | NeoForge mod with ModDevGradle, Gradle Groovy | 26.1 and newer |
| `data-pack` | Data pack with a load function | 1.21.9 and newer |
| `resource-pack` | Resource pack with a language override | 1.21.9 and newer |

`emd` refuses a Minecraft version outside a preset's range. When that happens, say there is no preset for that version yet. Do not rebuild an older layout from memory; read the `emd-version-facts` skill first.

Not covered yet: Forge, Quilt, plain Spigot or Bukkit, BungeeCord, Sponge, Bedrock add-ons, and Minecraft versions older than the ranges above.

## Check versions in an existing project

Run `emd versions --mc <version>` (add `--json` for scripts). It prints the Java version Mojang requires, the Paper dependency, the Fabric loader, API and Loom, the NeoForge build, the Velocity API, the current Gradle and the pack formats. Compare them with the project's build files and change related versions together, for example the Minecraft version and the Java version.

## Related skills

- `emd-version-facts`: what changed recently and what models usually get wrong.
- `emd-packs`: `pack.mcmeta`, folder names and functions for data packs and resource packs.
- `emd-build-troubleshooting`: Gradle and toolchain errors, with their causes.
- If the antislop skills are installed, follow them for README text and other prose you write.
