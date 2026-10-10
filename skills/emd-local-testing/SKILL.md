---
name: emd-local-testing
description: "Use when the user wants a Minecraft plugin, mod or pack tried out for real: starting the local test server, proxy or client that an emd project provides, and reading the result. Covers which task each preset provides, what to leave to the user and how to report. Triggers on: run the server, test my plugin, runServer, runClient, does it load, try it in game."
license: MIT
---
# Trying a project in a real server or client

An `emd` project builds with Gradle, but a build only proves it compiles. This is how to go one step further without making claims you cannot back.

## Which task starts what

Each generated project's `AGENTS.md` lists its tasks. Read it first. The presets provide these:

| Preset | Task | Starts |
|---|---|---|
| `paper-plugin-gradle` | `gradle runServer` | A local Paper server with the plugin loaded. Its files go in `run/` |
| `velocity-plugin` | `gradle runVelocity` | A local Velocity proxy with the plugin loaded. Its files go in `run/` |
| `fabric-mod` | `gradle runClient`, `gradle runServer` | A development client or server with the mod loaded |
| `neoforge-mod` | `gradle runClient`, `gradle runServer`, `gradle runData` | A development client, a server, or the data generators |
| `data-pack`, `resource-pack` | none | Copy the folder into a world's `datapacks` folder or the client's resource pack folder, then use `/reload` or the options screen |

None of these tasks has been proven by `emd` itself yet. If one fails, report the first error and do not work around it with a guess.

## Rules

- **Never accept the Minecraft EULA for the user.** If a server stops and asks for it, tell the user, and let them accept it themselves.
- **A server is a long-running process.** Start it in the background, read its log for the plugin or mod loading and for errors, then stop it. Do not leave it running when you finish.
- **A client needs a screen and a player.** An AI tool in a terminal usually cannot play it. Ask the user to start it and tell you what they see, or say that you did not run it.
- **The first NeoForge build is slow**, about ten minutes on a desktop, because ModDevGradle prepares Minecraft. Give it a long timeout and do not read a quiet console as a hang.
- **Do not change the project to make a run pass.** If the run shows a real error, fix the cause. Do not edit generated version lines.
- **Do not connect to servers that are not the user's own.**

## Report

- The exact task you ran and whether it started.
- The log lines that show the plugin or mod loading, or the first error.
- What you did not try, such as a client run, a second Minecraft version or a Folia server.
- If you only built it, say "built, not run".
