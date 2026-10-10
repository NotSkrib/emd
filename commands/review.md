---
description: Review Minecraft plugin, mod, pack or build-file changes for stale versions, wrong dependency formats and bad pack metadata. Read-only
argument-hint: "[files or a folder, optional]"
---
Review these Minecraft changes for mistakes that come from outdated knowledge: $ARGUMENTS

If nothing was typed, review the current uncommitted changes (`git diff`, and `git diff --staged`).

Hand the review to the `emd-reviewer` agent. It checks every version, dependency and descriptor against live data from the `emd` command, and it does not change any file. If that agent is not available, review the changes yourself against the `emd-version-facts` skill and check each version with `emd versions --mc <version>`.

Report findings with the file and line, what is wrong, the evidence, and the fix, ordered by how likely they are to break the project. If you find nothing, say what you checked and what you could not check.
