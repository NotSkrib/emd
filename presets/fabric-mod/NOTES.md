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
- **The newest Loom needs the newest Gradle.** Loom 1.18.x declares Gradle 9.7.0 as its minimum; on 9.5.1 the build stops with "No matching variant of net.fabricmc:fabric-loom". The generated README tells the user to use the Gradle version the resolver reported. Because the plugin is evaluated before any task runs, `gradle wrapper` fails the same way on an old Gradle, so the README says to run it in an empty folder.
- Do not read `project` inside a `filter { }` closure. It runs at execution time and fails with `org.gradle.configuration-cache=true`, which `gradle.properties` turns on. Read the version into a local first, as `build.gradle` does. A shipped-preset test checks this.
- The Gradle wrapper is not generated, because `gradle-wrapper.jar` is a binary and the preset format has none.

## Status

Built with real Gradle on 2026-10-09, exactly as `emd new` generates it: Gradle 9.8.1, Java 25, Minecraft 26.3, Fabric Loader 0.19.5, Fabric API 0.162.0+26.3, Loom 1.18.3. Both source sets compile, the jar holds both entrypoints, `fabric.mod.json` has the version filled in, and the build is clean with the configuration cache on. An earlier build on Gradle 9.5.1 (with Loom 1.17.21, the newest that Gradle accepts) found the `filter` bug above, and Gradle 9.5.1 with Loom 1.18.3 fails as described.

Not yet proven: `runClient` and `runServer`. Nothing has started the game.
