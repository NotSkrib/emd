---
name: emd-build-troubleshooting
description: "Use when a Minecraft Gradle build fails or behaves oddly: No matching variant errors, Gradle plugin or Java version mismatches, class file has wrong version, configuration cache errors, a $ in text breaking the build, or a first build that seems stuck. Covers Paper, Velocity, Fabric Loom and NeoForge ModDevGradle projects."
license: MIT
---
# Minecraft Gradle build problems

Find the symptom, apply the fix, and rebuild. Run `emd versions` first if a version might be wrong. It prints the current Gradle, the Java a Minecraft release needs, and the plugin versions.

| Symptom | Cause | Fix |
|---|---|---|
| `No matching variant of net.fabricmc:fabric-loom` (or `xyz.jpenilla:run-task`, or a NeoForged plugin) with `org.gradle.plugin.api-version` in the message | The installed Gradle is older than the plugin's minimum. | Use the Gradle version the project README names: `gradle wrapper --gradle-version <version>`. An old Gradle cannot even configure the project, so if that command fails, run it in an empty folder and copy `gradlew`, `gradlew.bat` and `gradle/` into the project. |
| `class file has wrong version 69.0, should be 65.0` (the numbers vary) | A dependency was compiled for a newer Java than the project's `--release` or toolchain. A Velocity API is compiled for its own Java version, which is not the Minecraft one. | Raise the Java version in the build file to the dependency's. `emd versions` shows the Java Mojang needs, and `emd new --preset velocity-plugin` reads the Velocity one. |
| `No matching toolchains found for requested specification` | No JDK of the requested version is installed, and the build has no toolchain resolver. | Install that JDK and point `JAVA_HOME` at it. The NeoForge preset also applies the foojay resolver plugin, which downloads a JDK. |
| `Invocation of 'project' references a Gradle script object from a Groovy closure at execution time`, or `Task.project at execution time has been deprecated` | A closure such as `filter { }` reads `project` while the task runs. The configuration cache forbids that and Gradle 10 will reject it. | Read the value into a local variable when the task is configured and use the variable in the closure. See `emd-version-facts`. |
| Resource processing fails or produces odd text when the description contains `$` | `expand(...)` treats `${...}` as a template. | Replace fixed tokens such as `@version@` with `filter` instead of using `expand`. |
| The first NeoForge build runs for ten minutes with no output | ModDevGradle downloads Minecraft and NeoForge, then decompiles, patches and recompiles about 7,000 source files. | Let it finish. Later builds reuse the work. |
| `Unable to establish loopback connection` when the Gradle daemon starts | Something on the machine blocks the JVM's local sockets. It is an environment problem, not a project problem. `--no-daemon` does not avoid it, because Gradle still starts a single-use daemon. | On one affected Windows machine, setting the environment variable `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/nonexistent_uds_dir` for the build fixed it. Do not change the project to work around it. |

## Rules for fixing a build

- Change one thing, rebuild, and read the new error. Do not stack guesses.
- Do not downgrade a plugin to dodge an error before you have checked the Gradle version.
- Do not edit generated version lines by hand. Regenerate them with `emd`, or ask `emd versions` and change the related versions together.
- Report what you ran and what it printed. A build that was not run is not a build that passes.
