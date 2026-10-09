# neoforge-mod

A NeoForge mod for Minecraft 26.1 and newer: Gradle (Groovy) with ModDevGradle, Java, a common entrypoint, a client entrypoint, and a `neoforge.mods.toml` descriptor.

## Why it is built this way

- **Derived from the official MDK.** NeoForgeMDKs/MDK-26.3-ModDevGradle (MIT, per its `TEMPLATE_LICENSE.txt`) at commit 4dacaff. That repository is the per-version mirror the NeoForge project keeps in sync with its template source. The build file, `gradle.properties`, `settings.gradle`, the run configurations and the entrypoint classes follow it closely, because that is the layout NeoForge itself keeps working. The Groovy DSL is kept for the same reason.
- **ModDevGradle, not NeoGradle.** The MDK ships both; ModDevGradle is the simpler, faster plugin and the one the resolver tracks (`resolved.moddevgradle`).
- **Minecraft 26.1 and newer only.** Those releases are year-versioned and unobfuscated, and the descriptor and API shapes follow the 26.x MDK. Earlier releases need a different build and will be a separate preset rather than a branch inside this one.
- **Every version comes from the resolver.** Minecraft, the NeoForge build, ModDevGradle and Java are filled in by `emd new`. Do not hand-write them. The MDK hard-codes Java in `build.gradle`; this preset reads it from Mojang like the others.
- **Free text is written by emd, only versions go through Gradle.** The MDK fills `neoforge.mods.toml` with Gradle's `expand`, which runs a template engine over the file and fails on a `$` in the description or license. This preset writes the name, description, authors and license into the descriptor when the project is generated (escaped for TOML), and `generateModMetadata` replaces only `@mod_version@`, `@neo_version@` and `@minecraft_version_range@`. The replacement values are read into a local at configuration time, so the build works with the configuration cache that `gradle.properties` turns on.
- **The Java toolchain resolver is kept.** The MDK's `settings.gradle` applies the foojay resolver convention plugin, so Gradle can download the right JDK on a machine that has not got it.

## Left out on purpose

- **Example blocks, items and a creative tab.** The MDK registers a demo block, item and tab with language entries and a config class. A preset should start from the smallest mod that loads; registries are a feature preset's job.
- **The config class and screen.** They need translations in `en_us.json`. Add them with a config feature preset once one exists.
- **Mixins and access transformers.** Both are declared in the descriptor and target specific Minecraft code that can change between 26.x releases.
- **Publishing.** The MDK's `maven-publish` example is boilerplate for library authors.
- **The Gradle wrapper**, because `gradle-wrapper.jar` is a binary and the preset format has none.

## Gotchas

- The NeoForge version the resolver returns can be a beta. Newly released Minecraft versions often have only beta NeoForge builds for a while, and `emd new` says so in its warnings.
- The mod id appears in `gradle.properties`, the `MODID` constant, the descriptor and the asset folder names. Change them together.
- Code in the common entrypoint must not reference client classes. They are loaded only in the `Dist.CLIENT` class.
- A newer ModDevGradle can require a newer Gradle than the one installed. The generated README names the Gradle version to use.

## Status

Built with real Gradle on 2026-10-10, exactly as `emd new` generates it: Gradle 9.8.1, Java 25, Minecraft 26.3, NeoForge 26.3.0.64-beta, ModDevGradle 2.0.148. The build is clean with the configuration cache on, the jar holds both entrypoint classes, and `neoforge.mods.toml` has its versions filled in. The `presets` workflow now builds it on every change and every night.

The first build is slow: ModDevGradle downloads Minecraft and NeoForge, then decompiles, patches and recompiles about 7,300 source files, which took about ten minutes on a desktop. Later builds reuse that work.

Not yet proven: `runClient` and `runServer`. Nothing has started the game.
