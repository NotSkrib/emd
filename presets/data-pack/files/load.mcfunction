# Runs when the world loads and every time the pack is reloaded, because
# data/minecraft/tags/function/load.json lists it.
tellraw @a "{{input.title|json}} loaded"
