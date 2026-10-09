# resource-pack

A resource pack for Minecraft 1.21.9 and newer: `pack.mcmeta` and one language override. There is no build step. The folder is the pack.

## Why it is built this way

- **Original, written from the format's rules.** Packs have no build file to copy from a project. The rules come from the Minecraft Wiki pages "Pack.mcmeta" and "Pack format", read on 2026-10-10. The wiki is reference reading only; no text was copied.
- **`min_format` and `max_format`, never `pack_format`.** Same reason as the data pack preset: Minecraft 1.21.9 (25w31a) replaced the single field, and `checkPackMcmeta` (`src/presets/packCheck.ts`) rejects the old shape in a test of this preset's output.
- **The resource pack format is a different number from the data pack format.** 26.3 is resource 97.1 and data 121.0. Using one for the other makes the game flag the pack as incompatible. The numbers come from the resolver (misode/mcmeta, read at run time, nothing copied).
- **A language override as the example.** A texture would need a binary PNG, which the preset format cannot hold. Renaming the stick in `assets/minecraft/lang/en_us.json` is visible in the game at once and uses a key (`item.minecraft.stick`) that has existed for years. It shows how a vanilla file is replaced by one at the same path.

## Left out on purpose

- **`pack.png`, textures, models and sounds.** All are binary. Add them under `assets/`.
- **Overlays, filters and extra languages.** They are optional `pack.mcmeta` sections. Add them when a pack needs to support several Minecraft versions.
- **Older versions.** Before 1.21.9 `pack.mcmeta` uses `pack_format`. That is a different preset.

## Gotchas

- The format of a brand-new release can be missing from the source for a while. `emd new` then fails with a warning instead of guessing a number.
- Packs are enabled in the game's options, not by being in the folder. The pack list shows an incompatible pack with a warning instead of hiding it.

## Status

Written and unit tested, including a check of the generated `pack.mcmeta`. Not yet proven: loading the pack in a game.
