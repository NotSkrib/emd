---
description: Plan a Minecraft project before building it, covering platform, preset, versions, inputs and risks. Waits for your OK before creating anything
argument-hint: "[what you want to build]"
---
Plan this Minecraft project: $ARGUMENTS

Do not create or change any file yet. Use the `emd` command for every fact (run it as `npx emd-minecraft` if `emd` is not on the PATH).

1. **Platform.** Work out what the user wants to make. If it could be more than one thing, ask one short question and stop.
2. **Preset.** Run `emd preset list`, then `emd preset show <id>` for the best match. Name the preset, or say that none fits and what is missing. Do not improvise a layout.
3. **Versions.** Run `emd versions` to see the newest release, then `emd versions --mc <version>` for the version the user needs. Report only what `emd` printed: the Java version, the platform's build for that release, and every warning (for example a beta-only build, or Folia trailing Paper).
4. **Inputs.** List what the preset asks for, and which of it you still need from the user.
5. **Proof.** Say what you will run to prove it (usually `gradle build`, or a `pack.mcmeta` check for a pack) and what you cannot prove without starting a server or the game.

Present the plan under these headings: Platform and preset, Versions, Inputs needed, Steps, Risks. Then stop and wait for the user to confirm or change it. When they confirm, carry it out with `/emd:new`.
