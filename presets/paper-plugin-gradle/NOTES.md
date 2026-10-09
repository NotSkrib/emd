# paper-plugin-gradle

A single-module Paper plugin: Gradle Kotlin DSL, Java, a `plugin.yml`, a main class and a local test server.

## Why it is built this way

- **Versions come from the resolver, never from this file.** The Paper dependency (`26.3.build.+` from Minecraft 26.1, `1.21.11-R0.1-SNAPSHOT` before) and the Java version (read from Mojang) are filled in by `emd new`. Do not hand-write either.
- **`run-paper` provides `gradle runServer`.** The plugin version (3.1.0) is the one MiniMOTD uses at commit 1445370. It is pinned here because the resolver does not track Gradle plugin versions yet. If a nightly check starts failing, look here first.
- **The plugin version lives in one place.** `plugin.yml` holds `@version@`, which `processResources` replaces with Gradle's `project.version`.
- **`api-version` is the Minecraft version you targeted.** To support older servers, generate with an older `--mc`. MiniMOTD compiles against the oldest API it supports for the same reason.
- **Java toolchain and `options.release` both use the resolved Java version**, so the jar runs on the Java the target Minecraft needs.

## Gotchas

- `folia` only sets `folia-supported` in `plugin.yml`. Declaring it without using Folia's region schedulers breaks the plugin on Folia. Folia usually trails Paper by a release, so check the warnings from `emd versions --mc <version>`.
- The Gradle wrapper is not generated. Run `gradle wrapper` once in the new project if you want `./gradlew`.
- Free text (description, author) is escaped for the file it lands in. If you add a template that uses an answer, give it a filter such as `|yaml`, `|kotlin`, `|java` or `|xml`, or `emd` refuses to render it.

## Status

Written and unit tested. Not yet proven: nothing has built a generated project with Gradle or booted it on a server, so the build file has not been run against real Paper artifacts.
