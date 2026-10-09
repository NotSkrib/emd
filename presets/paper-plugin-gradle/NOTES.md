# paper-plugin-gradle

A single-module Paper plugin: Gradle Kotlin DSL, Java, a `plugin.yml`, a main class and a local test server.

## Why it is built this way

- **Versions come from the resolver, never from this file.** The Paper dependency (`26.3.build.+` from Minecraft 26.1, `1.21.11-R0.1-SNAPSHOT` before) and the Java version (read from Mojang) are filled in by `emd new`. Do not hand-write either.
- **`run-paper` provides `gradle runServer`.** The plugin version is pinned to 3.0.2, which needs Gradle 8.14.3 or newer. MiniMOTD at commit 1445370 uses 3.1.0, but that release declares Gradle 9.7.0 as its minimum and fails on anything older with "No matching variant of xyz.jpenilla:run-task". The resolver does not track Gradle plugin versions yet, so this is a manual pin. If a nightly check starts failing, look here first.
- **The plugin version lives in one place.** `plugin.yml` holds `@version@`, which `processResources` replaces with the project version. The version is read into a local at configuration time: reading `project` inside the `filter { }` closure runs at execution time, which Gradle 10 will reject. A shipped-preset test checks this.
- **`api-version` is the Minecraft version you targeted.** To support older servers, generate with an older `--mc`. MiniMOTD compiles against the oldest API it supports for the same reason.
- **Java toolchain and `options.release` both use the resolved Java version**, so the jar runs on the Java the target Minecraft needs.

## Gotchas

- `folia` only sets `folia-supported` in `plugin.yml`. Declaring it without using Folia's region schedulers breaks the plugin on Folia. Folia usually trails Paper by a release, so check the warnings from `emd versions --mc <version>`.
- The Gradle wrapper is not generated, because `gradle-wrapper.jar` is a binary and the preset format has none. The generated README tells the user which Gradle version to use.
- Free text (description, author) is escaped for the file it lands in. If you add a template that uses an answer, give it a filter such as `|yaml`, `|kotlin`, `|java` or `|xml`, or `emd` refuses to render it.

## Status

Built with real Gradle on 2026-10-09 (9.5.1 and 9.8.1): Java 25, Minecraft 26.3, `paper-api:26.3.build.+`. The build is clean with `--warning-mode all`, and the jar holds the main class and a `plugin.yml` with the version filled in. That build found the `run-paper` pin and the `project` problems above.

Not yet proven: `gradle runServer`, and the plugin loading on a booted Paper server.
