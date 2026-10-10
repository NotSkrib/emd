---
description: Diagnose and fix a failing Minecraft Gradle build (Paper, Velocity, Fabric Loom or NeoForge ModDevGradle), one change at a time
argument-hint: "[error text or the build command, optional]"
---
Fix this failing Minecraft build: $ARGUMENTS

1. If no error text was given, run the project's build command from its `README.md` or `AGENTS.md` (usually `gradle build`) and read the first error.
2. Look the error up in the `emd-build-troubleshooting` skill. Typical causes are a Gradle older than a plugin needs ("No matching variant"), a Java version that does not match the dependency ("class file has wrong version"), `expand` over text that contains a `$`, and `project` read inside a `filter` closure.
3. When a version might be wrong, check it with `emd versions --mc <the project's Minecraft version>` (as `npx emd-minecraft` if `emd` is not on the PATH).
4. Make one change, rebuild, and read the new error. Do not stack guesses.
5. Do not downgrade a plugin, and do not edit the generated version lines by hand, to make an error go away.

Report what the error was, what caused it, what you changed, and the result of the final build. If you could not fix it, say what you tried and what the build still prints.
