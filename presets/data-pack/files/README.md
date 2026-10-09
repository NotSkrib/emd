# {{input.title|xml}}

{{input.description|xml}}

A data pack for Minecraft {{resolved.minecraft}} and newer in the same format line (data pack format {{resolved.dataPackFormat}}.{{resolved.dataPackFormatMinor}}).

## Install

Copy this folder into the `datapacks/` folder of a world, or zip its contents so that `pack.mcmeta` is at the root of the zip. Then run `/reload` in the game. `/datapack list` shows the pack, and chat shows "{{input.title|xml}} loaded".

## What is in it

- `data/{{input.name}}/function/load.mcfunction` runs when the world loads and on every reload.
- `data/minecraft/tags/function/load.json` is what makes that happen.
