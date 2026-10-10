---
description: Upgrade a Minecraft plugin, mod, data pack or resource pack to a newer Minecraft version by comparing it with a fresh emd project
argument-hint: "[target Minecraft version, default latest]"
---
Upgrade this Minecraft project to a newer Minecraft version: $ARGUMENTS

If no version was typed, use the newest release (`--mc latest`).

Hand the work to the `emd-upgrader` agent. It reads the project, runs `emd versions --mc <target>`, generates a reference project in a temporary folder with `emd new`, compares the two, changes the versions that move together, and rebuilds. If that agent is not available, follow the `emd-upgrade-minecraft` skill yourself.

Before changing anything, tell the user the current versions and the target versions, and stop if a platform has no build for the target yet. Do not commit or push.

Report the versions before and after, each file you changed, each command you ran and whether it passed, and what you did not prove. Say "built, not run" unless you ran it.
