# velocity-plugin

A single-module Velocity proxy plugin: Gradle Kotlin DSL, Java, a `velocity-plugin.json` descriptor, a main class and a local test proxy.

## Why it is built this way

- **Derived from MiniMOTD's Velocity module.** jpenilla/MiniMOTD (MIT) at commit 1445370: `platform/velocity/build.gradle.kts` for the `run-velocity` plugin, the `compileOnly` API dependency and the descriptor fields, and `MiniMOTDVelocity.java` for the Guice `@Inject` constructor and the `@Subscribe` event handler. MiniMOTD is a multi-module build with its own convention plugins, so only the Velocity-specific parts were taken.
- **The descriptor is a plain file, not generated.** MiniMOTD generates `velocity-plugin.json` with a resource-factory plugin; Velocity's own docs use an annotation processor. A static file needs neither, and it is the one format both of them produce.
- **Java comes from the Velocity API, not from Minecraft.** A proxy is not tied to one Minecraft release, and the API declares the Java version it was compiled for (25 for Velocity 4.2.0). `emd new` reads that from the API's Gradle module metadata as `resolved.velocityJava`. Using the Minecraft version's Java would fail on an older Minecraft: javac refuses to read class files newer than its `--release`.
- **`--mc` is optional.** This is a proxy preset, so `emd new` does not demand a Minecraft version.
- **`run-velocity` provides `gradle runVelocity`.** It is the same plugin as `run-paper` and is pinned to 3.0.2 for the same reason: 3.1.0 needs Gradle 9.7.0 or newer, 3.0.2 needs 8.14.3.
- **The plugin version lives in one place.** The descriptor holds `@version@`, which `processResources` replaces with the project version, read at configuration time so the build works with the configuration cache and Gradle 10.

## Gotchas

- The plugin `id` must match `[a-z][a-z0-9_-]{0,63}`. The `slug` input type is stricter (no hyphen), which is always valid.
- The main class needs the `@Inject` constructor. Without it Velocity cannot build the plugin.
- The Gradle wrapper is not generated, because `gradle-wrapper.jar` is a binary and the preset format has none. The generated README tells the user which Gradle version to use.
- Free text (description, author) is escaped for the file it lands in. If you add a template that uses an answer, give it a filter such as `|json`, `|kotlin` or `|xml`, or `emd` refuses to render it.

## Status

Built with real Gradle on 2026-10-09: Gradle 9.5.1, Velocity API 4.2.0, Java 25, generated without `--mc`. The build is clean with `--warning-mode all` and the jar holds the main class and a `velocity-plugin.json` with the version filled in.

Not yet proven: `gradle runVelocity`, and the proxy loading the plugin. The static `velocity-plugin.json` is modelled on what MiniMOTD's resource-factory plugin generates, not on a run of the proxy.
