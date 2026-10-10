---
name: emd-release-checklist
description: "Use when a Minecraft plugin, mod, data pack or resource pack is about to be shared, tagged or uploaded, or when asked whether a project is ready to release. Lists what to check in the built jar or the pack folder and how to report it honestly. Triggers on: release, publish a plugin, ready to ship, upload to Modrinth or Hangar, version bump, build the final jar."
license: MIT
---
# Release checklist

Work through this list and report each line as done, failed or not checked. Uploading to a download site, signing in to one, and tagging or pushing are the user's steps. Never do them unasked.

## Gradle projects (plugin or mod)

1. **Versions match the target.** Run `emd versions --mc <the Minecraft version you target>` (as `npx emd-minecraft` if `emd` is not on the PATH). The Minecraft, Java, platform and plugin versions in the build must be the ones it prints, or deliberate older ones.
2. **One version number.** The project version is set in one place (the build file or `gradle.properties`) and the descriptor takes it from there. Change it there, not in the descriptor.
3. **Clean build.** Build from a clean state with the Gradle version the README names, for example `gradle clean build`. A build that only passes from a warm cache is not proof.
4. **Open the jar.** List its contents with `jar tf build/libs/<name>.jar` and read the descriptor inside (`plugin.yml`, `velocity-plugin.json`, `fabric.mod.json` or `META-INF/neoforge.mods.toml`). The main classes must be there and the version must be a real version, not `@version@` or another placeholder.
5. **Descriptor fields.** The name, authors, website, description and license are what the user wants public. Do not add a personal name, an email address or a link the user did not give you.
6. **License.** The project states one. Code copied from another project keeps that project's license and credit.
7. **No secrets.** Search the source and resources for tokens, passwords, webhook URLs and keys. A jar is public.
8. **Folia.** If `folia-supported` is true, check the code against the `emd-folia-threading` skill.

## Data packs and resource packs

1. `pack.mcmeta` has `min_format` and `max_format`, and no `pack_format` or `supported_formats`, for Minecraft 1.21.9 and newer. The numbers come from `emd versions --mc <version>`, on the `Packs` line, and the data pack and resource pack numbers differ (see the `emd-packs` skill).
2. Every `.json` and `.mcmeta` file parses.
3. Folder names are singular (`function`, `recipe`, `loot_table`) for Minecraft 1.21 and newer.
4. The zip has `pack.mcmeta` at its top level, not inside a folder.

## Report

- List what you checked and the command you ran for each.
- List what you could not check. If no server or client was started, say: "built and inspected, not run in the game".
- A README that claims the plugin or mod works must be backed by a run. If you did not run it, do not write that it works.
