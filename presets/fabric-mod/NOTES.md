# fabric-mod

A Fabric mod for Minecraft 26.1 and newer: Gradle (Groovy), Java, a common entrypoint, a client entrypoint, and Fabric API.

## Why it is built this way

- **Derived from the official example mod.** FabricMC/fabric-example-mod (CC0) at commit 44465cb. The build file, `gradle.properties` and `settings.gradle` follow it closely, because that is the layout Fabric itself keeps working. The Groovy DSL is kept for the same reason.
- **Minecraft 26.1 and newer only.** Those releases are unobfuscated, so the build uses the `net.fabricmc.fabric-loom` plugin, no mappings, and plain `implementation`. Older releases need `net.fabricmc.fabric-loom-remap`, mappings and `modImplementation`, which is a different build. That will be a separate preset rather than a branch inside this one.
- **Every version comes from the resolver.** Minecraft, Fabric Loader, Fabric API, Loom and the Java version are filled in by `emd new`. Do not hand-write them.
- **The mod version lives in one place.** `fabric.mod.json` holds `@version@`, which `processResources` replaces from `gradle.properties`. The example uses Gradle's `expand`, which runs a template engine over the file and breaks on a `$` in a description, so this preset uses a plain text replacement instead.

## Left out on purpose

- **Mixins.** The example's mixins target specific Minecraft methods that can change between 26.x releases. Add them with a mixin feature preset once one exists.
- **An icon.** The preset format has no binary files yet.
- **A license.** Which license your mod uses is your call. Add a `license` field to `fabric.mod.json` and a `LICENSE` file.
- **Publishing.** Maven publishing is boilerplate for library authors.

## Gotchas

- Upstream pins Loom as `1.18-SNAPSHOT`; the resolver picks the newest stable Loom. If a brand-new Minecraft release needs a snapshot, change `loom_version` in `gradle.properties` and tell the resolver.
- Code in `src/main` must not reference classes from `src/client`.
- The Gradle wrapper is not generated. Run `gradle wrapper` once if you want `./gradlew`.

## Status

Written and unit tested. Not yet proven: nothing has built a generated project with Gradle or started it with `runClient`.
