---
name: emd-folia-threading
description: "Use when writing or reviewing a Paper plugin that must run on Folia, or when someone sets folia-supported: true. Covers what Folia changes about threads and the four schedulers to use. Triggers on: Folia, folia-supported, regionised multithreading, region scheduler, entity scheduler, run a task on Folia."
license: MIT
---
# Folia support in a Paper plugin

Source: the Paper project's own documentation (docs.papermc.io, Folia overview and "Folia support" pages). Check them again for anything not on this page.

## What Folia changes

Folia splits the chunks of each loaded world into independently ticking regions. Regions tick in parallel on different threads, and only the thread that ticks a region may write that region's data. A plugin written for one main thread therefore cannot assume that every entity, block and world is safe to touch from whichever code is running.

## Declaring support

Add `folia-supported: true` to `plugin.yml` (or `paper-plugin.yml`). The Paper docs say that key alone is not enough: the plugin must actually be written for Folia. A plugin that sets it without using Folia's schedulers is declaring something untrue. The `paper-plugin-gradle` preset has a `folia` input, off by default, and writes its value into that key. Turning the input on changes only the key, not the code.

## The four schedulers

Use the one that matches what the task touches:

| Scheduler | Get it from | Use it for |
|---|---|---|
| `GlobalRegionScheduler` | `server.getGlobalRegionScheduler()` | Tasks that belong to no region |
| `RegionScheduler` | `server.getRegionScheduler()` | Work at a location, such as `execute(plugin, location, runnable)`. Not for operations on an entity |
| `AsyncScheduler` | `server.getAsyncScheduler()` | Work that does not depend on the server tick |
| `EntityScheduler` | `entity.getScheduler()` | Operations on an entity. It follows the entity when it moves between regions |

The Paper docs say these schedulers also work on Paper, where they are handled internally, so one code path can serve both servers.

## Rules for the AI tool

- Do not keep using the old Bukkit scheduler in a plugin that claims Folia support. The Paper docs tell you to use the schedulers above, so do not assume anything else is safe.
- Pick the scheduler from what the task touches: an entity, a location, nothing in the world, or the server as a whole. If you cannot say which, ask the user rather than guess.
- Do not read or change an entity, block or chunk from code that is not running on the scheduler that owns it.
- Folia usually trails Paper by a Minecraft release. Check `emd versions --mc <version>`: it prints whether Folia has a build for that version. Do not tell the user their plugin runs on Folia when Folia has no build for their version.
- Say what you did not prove. No preset has started a Folia server, so say plainly if the plugin was only compiled.
