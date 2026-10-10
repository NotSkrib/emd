---
description: Check that a Minecraft plugin, mod or pack is ready to share, using the release checklist. Does not upload or publish anything
argument-hint: "[jar file or pack folder, optional]"
---
Check whether this Minecraft project is ready to release: $ARGUMENTS

If nothing was typed, use the project in the current folder.

Work through the `emd-release-checklist` skill. Check each versions line with `emd versions --mc <the project's Minecraft version>`, build from clean, open the built jar and read the descriptor inside it, and for a pack check `pack.mcmeta` and that every JSON file parses.

Report each checklist line as done, failed or not checked, with the command you ran. Do not upload, sign in to a download site, tag, commit or push. Those are the user's steps. If nothing was started in a server or client, say "built and inspected, not run in the game".
