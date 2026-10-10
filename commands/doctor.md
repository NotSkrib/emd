---
description: Check that the Java, Gradle and Node on this machine fit the Minecraft project in the current folder. Read-only
argument-hint: "[build error text, optional]"
---
Check whether this machine can build this Minecraft project: $ARGUMENTS

Hand the check to the `emd-doctor` agent. It reads the project's Minecraft version, runs `emd versions --mc <version>` to learn the Java version needed, compares that with `java -version`, `javac -version`, `gradle --version` and `node --version`, and changes nothing. If that agent is not available, do the same comparison yourself and use the `emd-build-troubleshooting` skill for any error text that was given.

Report a table of what the project needs, what the machine has and whether they match, then the one change that unblocks the build. Give the exact command for the user to run. Do not install anything.
