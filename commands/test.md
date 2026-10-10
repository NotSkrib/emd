---
description: Try a Minecraft project in a real local server, proxy or client and report exactly what happened
argument-hint: "[task such as runServer, optional]"
---
Try this Minecraft project in a real run: $ARGUMENTS

If no task was typed, read the project's `AGENTS.md` and pick the run task that fits it (`gradle runServer`, `gradle runVelocity`, `gradle runClient`). Follow the `emd-local-testing` skill.

Never accept the Minecraft EULA for the user. If the server asks for it, stop and tell them. Start a server or proxy in the background, read its log for the plugin or mod loading and for errors, then stop it. A client needs a screen, so ask the user to run it and tell you what they see.

Report the exact task you ran, whether it started, the log lines that show the plugin or mod loading or the first error, and what you did not try. If you only built it, say "built, not run".
