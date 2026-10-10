---
description: Plan a Minecraft project before building it. Asks for the project name, package and author, shows the platform, preset, versions and risks, and waits for your OK before creating anything
argument-hint: "[what you want to build]"
---
Plan this Minecraft project: $ARGUMENTS

Do not create or change any file yet. Use the `emd` command for every fact (run it as `npx emd-minecraft` if `emd` is not on the PATH).

1. **Platform.** Work out what the user wants to make. If it could be more than one thing, ask one short question and stop.
2. **Preset.** Run `emd preset list`, then `emd preset show <id>` for the best match. Name the preset, or say that none fits and what is missing. Do not improvise a layout.
3. **Versions.** Run `emd versions` to see the newest release, then `emd versions --mc <version>` for the version the user needs. Report only what `emd` printed: the Java version, the platform's build for that release, and every warning (for example a beta-only build, or Folia trailing Paper).
4. **Ask for the inputs now.** `emd preset show <id>` lists every input and marks the required ones. Ask the user for each required input they have not already given, in one message, as a numbered list with the preset's example beside each (usually the project name, the Java package and the author). Then offer the optional inputs that have a default, such as the version and the description, and ask if they want to change any. If Folia came up and the preset has a `folia` input, ask about that too. Use any answer the user already put in their request and do not ask for it again. You may suggest a value, such as a package built from the author and the name, but it only counts once the user confirms it. Never fill in a name, author or package yourself.
5. **Proof.** Say what you will run to prove it (usually `gradle build`, or a `pack.mcmeta` check for a pack) and what you cannot prove without starting a server or the game.

Send steps 1 to 3 and the questions from step 4 together in one message, then stop and wait for the answers.

When the answers arrive, present the plan under these headings: Platform and preset, Versions, Inputs (the values the user gave), Steps, Risks. Show the exact `emd new --preset <id> --mc <version> --set key=value --dry-run` command that will be run. Then stop and wait for the user to confirm or change it. When they confirm, carry it out with `/emd:new`, which reuses these answers.
