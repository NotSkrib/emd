---
description: Show live Minecraft, Java and platform versions (Paper, Folia, Fabric, NeoForge, Velocity, Gradle and pack formats)
argument-hint: "[minecraft version, optional]"
---
Show the current Minecraft versions. The user typed: $ARGUMENTS

Run the `emd` command (as `npx emd-minecraft` if `emd` is not on the PATH):

- With no version typed, run `emd versions`. It lists the newest Minecraft release and the newest release each platform supports.
- With a version typed, run `emd versions --mc <that version>`. It prints the Java version Mojang requires, the Paper dependency, the Folia, Fabric, NeoForge, Forge and Velocity builds, the current Gradle, and the pack formats.

Summarise what it printed in a short table. Repeat every warning it printed word for word. Do not add or correct a version from memory. If a platform has no build for that release, say so.
