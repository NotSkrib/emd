---
name: emd-preset-guide
description: "Use when working inside a project that emd generated, or choosing between emd presets: what each preset creates, where things live, and the rules that keep it building. Covers the Paper plugin, Velocity plugin, Fabric mod, NeoForge mod, data pack and resource pack presets. Triggers on: what does this preset make, where is the descriptor, why is this file generated this way."
license: MIT
---
# What each EMD preset makes

Every generated project has an `AGENTS.md` and `README.md` with its exact commands. They override this page. Run `emd preset show <id>` for the inputs a preset asks for.

## `paper-plugin-gradle`
- **Makes:** a Paper plugin with Gradle Kotlin DSL and Java. The descriptor is `src/main/resources/plugin.yml`; it holds `@version@`, which `processResources` replaces with the project version.
- **Commands:** `gradle build`, and `gradle runServer` for a local test server (files go in `run/`).
- **Rules:** `folia` only sets `folia-supported` in `plugin.yml`. Set it only for code written for Folia (see the `emd-folia-threading` skill). `api-version` is the Minecraft version you generated for; generate with an older `--mc` to support older servers.

## `velocity-plugin`
- **Makes:** a Velocity proxy plugin. The descriptor is `src/main/resources/velocity-plugin.json`. Its `id` and `main` must match the code, and the id matches `[a-z][a-z0-9_-]{0,63}`.
- **Commands:** `gradle build`, and `gradle runVelocity` for a local proxy.
- **Rules:** the main class needs the `@Inject` constructor, or Velocity cannot build the plugin. The Java version comes from the Velocity API, not from Minecraft, so `--mc` is optional.

## `fabric-mod`
- **Makes:** a Fabric mod for Minecraft 26.1 and newer, Gradle Groovy. Common code is in `src/main`, client-only code in `src/client` (Loom's split source sets). The descriptor is `src/main/resources/fabric.mod.json`.
- **Commands:** `gradle build`, `gradle runClient`, `gradle runServer`.
- **Rules:** code in `src/main` must never reference classes from `src/client`. The versions live in `gradle.properties`.

## `neoforge-mod`
- **Makes:** a NeoForge mod for Minecraft 26.1 and newer, with ModDevGradle. The descriptor is `src/main/templates/META-INF/neoforge.mods.toml`. The name, description, authors and license were written when the project was generated; the build fills in only `@mod_version@`, `@neo_version@` and `@minecraft_version_range@`.
- **Commands:** `gradle build`, `gradle runClient`, `gradle runServer`, `gradle runData`. The first build is slow (about ten minutes on a desktop) while ModDevGradle prepares Minecraft; later builds are faster.
- **Rules:** the mod id appears in `gradle.properties`, the `MODID` constant, the descriptor and the asset folder names. Change them together. Client code goes only in the `Dist.CLIENT` class. The NeoForge build for a new Minecraft release can be a beta; `emd new` warns.

## `data-pack` and `resource-pack`
- **Make:** a data pack (a `load` function and its tag) or a resource pack (a language override), for Minecraft 1.21.9 and newer. There is no build. The `emd-packs` skill covers the format and layout.

## For all of them
- The Gradle wrapper is not generated, because the preset format has no binary files. The README names the Gradle version to use.
- The `run*` tasks are listed in each project's `AGENTS.md`. The presets have been built, but their run tasks have not been proven yet, so do not claim they work until you have run them.
- Do not edit the generated Minecraft, Java, platform or plugin versions by hand. They are a matched set. To change them, regenerate, or follow the `emd-upgrade-minecraft` skill.
- Free text such as the description is already escaped for the file it lands in. If you add text to a file yourself, escape it for that language.
