---
name: emd-upgrade-minecraft
description: "Use when upgrading an existing Minecraft plugin, mod, data pack or resource pack to a newer Minecraft version, or when a project stopped building after a Minecraft update. Gives the order to change things and the boundaries where a format changed, using live data from emd. Triggers on: update to a new Minecraft version, port a mod, bump the Minecraft version, broke after an update."
license: MIT
---
# Upgrading a project to a newer Minecraft version

The reliable method is to compare your project with a fresh one that `emd` generates for the target version. Guessing which lines changed from memory is how upgrades go wrong.

## Steps

1. **Find where you are.** Read the Minecraft, Java, platform and Gradle versions from the project's build files, `gradle.properties` and descriptor. Note the preset it came from, if any (its `AGENTS.md` says).
2. **Find where you are going.** Run `emd versions --mc <target>` (as `npx emd-minecraft` if `emd` is not on the PATH). Report the Java version, the platform's build for that release and every warning. If a platform has no build for the target yet, stop and tell the user.
3. **Generate a reference.** Run `emd new --preset <id> --mc <target> --dir <a temporary folder outside the project> --set name=Reference ...` with throwaway answers for the other inputs. Compare its build files, descriptors and `gradle.properties` with yours. Every difference in a version, plugin id, dependency or descriptor field is a candidate change.
4. **Change related versions together.** The Minecraft version, the Java toolchain and `--release`, the platform's dependency, and the plugin versions move as a set. Do not change one and leave the others.
5. **Rebuild and fix one error at a time.** Use the `emd-build-troubleshooting` skill for Gradle and Java errors.
6. **Report honestly.** Say which versions changed, what built, and what you did not prove. Errors about Minecraft or platform code that no longer exists are real API changes. `emd` does not know them: read the platform's own changelog, and do not guess a replacement.

## Boundaries where the format changed

| Crossing | What changes |
|---|---|
| 1.21.11 to 26.1 | Releases are named by year. Paper's dependency becomes `paper-api:<minecraft>.build.+`. Fabric becomes unobfuscated: plugin `net.fabricmc.fabric-loom`, no mappings, plain `implementation` instead of `modImplementation`. NeoForge versions follow the Minecraft version. |
| Any release with a newer Java | Raise the toolchain and `--release` together. A dependency compiled for a newer Java fails with "class file has wrong version". |
| Before to after 1.21 | Data pack folders become singular (`function`, `recipe`, `loot_table`, `tags/function`, `tags/item`). |
| Before to after 1.21.9 | `pack.mcmeta` uses `min_format` and `max_format`. `pack_format` and `supported_formats` must go. |
| Any release | A newer Loom, ModDevGradle or `run-paper` can need a newer Gradle. "No matching variant" means the Gradle is too old. |

A Velocity plugin is not tied to one Minecraft release, so it often needs no change for a new Minecraft version. Its Java version comes from the Velocity API; `emd versions` prints it.

## Do not

- Do not cross several boundaries in one step if the build then breaks in ways you cannot separate. Go one boundary at a time.
- Do not edit generated version lines to quiet an error. Regenerate the reference and compare.
