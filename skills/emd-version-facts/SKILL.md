---
name: emd-version-facts
description: "Facts about Minecraft modding that changed recently and that models usually get wrong: year-based Minecraft versions, Paper's new dependency format, the Java version per release, unobfuscated Fabric and NeoForge, pack.mcmeta formats, the Java version of the Velocity API, and Gradle build-script traps. Use when writing or reviewing any Minecraft build file, plugin descriptor or pack metadata."
license: MIT
---
# Minecraft facts that models get wrong

Checked against official sources and real builds in October 2026. Every row names a command that gives the current value. When this page and `emd` disagree, `emd` wins, and the page is out of date.

| Stale belief | What is true | Check with |
|---|---|---|
| Minecraft versions look like `1.21.x` and the next one is `1.22`. | The 1.x line ended with 1.21.11. Releases are named by year: `26.1`, `26.1.1`, `26.2` and so on. Treat a version as a string, not as `1.minor.patch`. | `emd versions` |
| Paper is `io.papermc.paper:paper-api:1.21.x-R0.1-SNAPSHOT`. | From 26.1 the dependency is `paper-api:<minecraft>.build.+`, for example `26.1.build.+`. The `-R0.1-SNAPSHOT` form is only for 1.21.11 and older. | `emd versions --mc <v>` (Paper line) |
| Minecraft needs Java 17 or 21. | The Java version is a property of the release. Mojang publishes it in each version's metadata. 1.21.11 needs Java 21 and recent 26.x releases need a newer one. | `emd versions --mc <v>` (first line) |
| A Fabric mod needs mappings and `modImplementation`. | From 26.1 Minecraft is unobfuscated: use the plugin id `net.fabricmc.fabric-loom` (not `fabric-loom-remap`), no mappings, and plain `implementation`. Older versions still need the remap plugin, mappings and `modImplementation`. | `emd versions --mc <v>` (Fabric line) |
| NeoForge versions look like `21.1.x`. | They follow the Minecraft version: `26.3.0.64-beta` is for Minecraft 26.3. A new Minecraft release often has only beta NeoForge builds. The plugin is ModDevGradle (`net.neoforged.moddev`) and the descriptor is `META-INF/neoforge.mods.toml`. | `emd versions --mc <v>` (NeoForge line) |
| A Velocity plugin uses the same Java as the Minecraft version. | Velocity versions are independent of Minecraft's. The Velocity API is compiled for a specific Java version, and a plugin cannot target an older one, or javac fails with "class file has wrong version". | `emd new --preset velocity-plugin` reads it |
| Folia and Purpur support every Paper release. | They can trail Paper by a release. A Paper plugin that declares Folia support must be written for Folia. | `emd versions --mc <v>` (Folia line) |
| `pack.mcmeta` has `pack_format`. | From Minecraft 1.21.9 it has `min_format` and `max_format`, and `pack_format` and `supported_formats` must be absent. Formats have a minor part. Data pack and resource pack formats are different numbers. See `emd-packs`. | `emd versions --mc <v>` (Packs line) |
| Data pack folders are `functions` and `recipes`. | Singular since Minecraft 1.21: `function`, `recipe`, `loot_table`, `advancement`, `tags/function`, `tags/item`. | `emd-packs` |
| Any recent Gradle builds any recent plugin. | Plugin releases raise their minimum Gradle. The newest Fabric Loom and `run-paper` stop on an older Gradle with "No matching variant". | `emd versions` (Gradle) |

## Gradle build-script traps

- **`processResources { expand(...) }` breaks on a `$`.** Gradle's `expand` runs a template engine over the file, so a description such as "costs $5" fails the build. Replace plain tokens instead, for example `filter { line -> line.replace("@version@", pluginVersion) }`.
- **Never read `project` inside a `filter { }` or other execution-time closure.** It fails with the configuration cache and Gradle 10 rejects it. Read the value into a local variable at configuration time and use that:

  ```kotlin
  processResources {
      val pluginVersion = project.version.toString()
      inputs.property("pluginVersion", pluginVersion)
      filesMatching("plugin.yml") { filter { line -> line.replace("@version@", pluginVersion) } }
  }
  ```
- **Free text needs escaping for the file it lands in.** A description or author name placed in YAML, JSON, TOML, Java or Kotlin must be escaped for that language. `emd new` does this; if you edit by hand, do it yourself.

## When you cannot check

If `emd` is not available or has no data for a version, say so. Do not fill the gap with a remembered version number. Link the user to the official source: Mojang's version manifest, `repo.papermc.io`, `meta.fabricmc.net`, `maven.neoforged.net`, or the Minecraft Wiki page "Pack format".
