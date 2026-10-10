---
name: emd-packs
description: "Use when creating or editing a Minecraft data pack or resource pack: pack.mcmeta, min_format and max_format, function and tag folders, language files, load and tick functions. Covers the format change in Minecraft 1.21.9 and the folder renames of 1.21. Triggers on: data pack, datapack, resource pack, texture pack, pack.mcmeta, mcfunction."
license: MIT
---
# Data packs and resource packs

Start a new pack with `emd new --preset data-pack --mc latest --set name=my_pack --set title="My Pack"` or `--preset resource-pack`. Both are for Minecraft 1.21.9 and newer. They need no build: the folder is the pack.

## pack.mcmeta for Minecraft 1.21.9 and newer

```json
{
  "pack": {
    "description": "A short description.",
    "min_format": [MAJOR, MINOR],
    "max_format": MAJOR
  }
}
```

- Get the numbers from `emd versions --mc <version>`, on the `Packs` line. It prints `data X.Y, resource X.Y`. Use the one that matches the kind of pack.
- `min_format` may be a number or a `[major, minor]` pair. A plain number means minor 0. A pack that uses features from minor 1 must say `[major, 1]`.
- `max_format` as a plain number means any minor version of that major. Use that so the pack keeps working across minor updates.
- **Do not write `pack_format` or `supported_formats`.** Minecraft 1.21.9 removed them for packs that only support 1.21.9 and newer.
- Data pack and resource pack formats are different numbers. Using one for the other makes the game mark the pack as incompatible.
- A pack that must also load on older Minecraft versions (data pack format below 82, resource pack format below 65) needs the old `pack_format` fields as well. No preset covers that yet.

## Data pack layout

```
pack.mcmeta
data/<namespace>/function/<name>.mcfunction
data/minecraft/tags/function/load.json     # functions that run on load and reload
data/minecraft/tags/function/tick.json     # functions that run every tick
```

- Folder names are singular since Minecraft 1.21: `function`, `advancement`, `recipe`, `loot_table`, `predicate`, `structure`, `item_modifier`, and `tags/item`, `tags/block`, `tags/entity_type`, `tags/fluid`, `tags/game_event`, `tags/function`. The plural names were renamed away and are not read.
- A tag file is `{ "values": ["namespace:function_name"] }`.
- Use your own namespace under `data/` and put only vanilla tag extensions under `data/minecraft/`.
- A function file holds one command per line. Lines starting with `#` are comments.
- Running something every tick has a cost. Add `tick.json` only when a pack needs it.

## Resource pack layout

```
pack.mcmeta
assets/minecraft/lang/en_us.json           # text overrides, one flat JSON object
assets/minecraft/textures/...              # replaces the vanilla file at the same path
assets/minecraft/models/...
assets/minecraft/sounds/...
```

- A file at the same path as a vanilla file replaces it.
- File and folder names under `assets/` use lowercase letters, digits, `_`, `-` and `.`.
- Textures, sounds and `pack.png` are binary files. Add them yourself; the presets ship text only.
- Every JSON file must be valid. One stray comma stops that file from loading.

## Check your work

- Open every `.json` and `.mcmeta` file as JSON. A parse error means the game will skip it.
- Check `pack.mcmeta` has `min_format` and `max_format` and no `pack_format`.
- In the game, `/reload` and `/datapack list` show a data pack. Options > Resource Packs shows a resource pack and flags an incompatible one.
- Say which of these you actually did. Do not claim a pack loads unless you loaded it.
