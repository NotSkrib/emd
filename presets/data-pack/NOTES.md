# data-pack

A data pack for Minecraft 1.21.9 and newer: `pack.mcmeta`, a `load` function tag and one function. There is no build step. The folder is the pack.

## Why it is built this way

- **Original, written from the format's rules.** Packs have no build file to copy from a project, and the layout is fixed by Minecraft itself. The rules come from the Minecraft Wiki pages "Pack.mcmeta", "Pack format", "Data pack" and "Function (Java Edition)", read on 2026-10-10. The wiki is reference reading only; no text was copied.
- **`min_format` and `max_format`, never `pack_format`.** Since 25w31a (1.21.9) the single `pack_format` was replaced by a range, and a pack that only supports 1.21.9 and newer must not carry `pack_format` or `supported_formats`. This is the mistake AI tools make most often with packs, so `checkPackMcmeta` (`src/presets/packCheck.ts`) rejects it and a test runs it on this preset's output.
- **The format numbers come from the resolver.** The data pack format of a release has a major and a minor part (26.3 is 121.0, 26.2 is 107.1). The minimum is written as `[major, minor]`, so the pack refuses a game that is older than the features it uses. The maximum is the bare major number, which the format defines as "any minor version", so the pack keeps working across minor updates. The source is misode/mcmeta, a community mirror of the version data Mojang ships in each release; EMD reads it at run time and copies nothing.
- **Singular folder names.** `function` and `tags/function` replaced `functions` and `tags/functions` in 1.21 (24w21a). The wiki lists the rename; a pack that still uses the plural names does not get its files read.
- **The name is also the namespace.** One input keeps the pack small and gives `emd new` a folder name. Split them when a pack needs several namespaces.

## Left out on purpose

- **`pack.png`.** The preset format has no binary files. Add a 64x64 PNG at the pack root for an icon.
- **A `tick` function.** Running something every tick is a cost most packs do not want by default.
- **Older versions.** Before 1.21.9 `pack.mcmeta` uses `pack_format`, and before 1.21 the folders are plural. That is a different preset.

## Gotchas

- The format of a brand-new release can be missing from the source for a while. `emd new` then fails with a warning instead of guessing a number.
- Text in `tellraw` is a text component. The title is escaped as a JSON string, which is a valid text component.

## Status

Written and unit tested, including a check of the generated `pack.mcmeta`. Not yet proven: loading the pack in a game or on a server.
