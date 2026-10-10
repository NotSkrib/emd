---
description: Create a new Minecraft plugin, mod, data pack or resource pack from a proven preset with live versions, then build it
argument-hint: "[what you want, e.g. a Fabric mod called Sparkle]"
---
Create a new Minecraft project for this request: $ARGUMENTS

Hand the work to the `emd-builder` agent and pass it the request above. If the request does not say which platform (Paper, Folia, Velocity, Fabric, NeoForge, data pack or resource pack), ask one short question first.

If that agent is not available, do it yourself with the `emd` command (run it as `npx emd-minecraft` if `emd` is not on the PATH):

1. `emd preset list`, then `emd preset show <id>` for the best match. If no preset fits, say so and stop.
2. Get every input the preset needs from the user. Do not invent a name, author or package.
3. `emd new --preset <id> --mc latest --set key=value ... --dry-run`, check the files, then run it again without `--dry-run`. Leave out `--mc` for a proxy preset.
4. Read the new project's `AGENTS.md` and `README.md`, then run the build command they give.
5. Report the versions `emd` chose, what you ran, whether it passed, and what you did not prove. Say plainly that you did not start a server or the game, unless you did.

Never write a Minecraft, Java, Paper, Fabric, NeoForge, Velocity or Gradle-plugin version from memory.
