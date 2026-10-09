import { expectRecord, isVersionToken } from "../util/json.js";
import type { ForgeBuilds, ForgePromos } from "./types.js";

/**
 * Groups promotions_slim.json entries such as "26.2-latest" and "26.2-recommended" by Minecraft
 * version. Entries whose version or build is not a plain version string are skipped.
 */
export function parseForgePromos(json: unknown): ForgePromos {
  const promos = expectRecord(expectRecord(json, "the Forge promotions").promos, "the Forge 'promos'");
  const grouped = new Map<string, ForgeBuilds>();

  for (const [key, build] of Object.entries(promos)) {
    const match = /^(.+)-(latest|recommended)$/.exec(key);
    const mcVersion = match?.[1];
    const kind = match?.[2];
    if (!mcVersion || !isVersionToken(mcVersion)) continue;
    if (kind !== "latest" && kind !== "recommended") continue;
    if (typeof build !== "string" || !isVersionToken(build)) continue;
    grouped.set(mcVersion, { ...grouped.get(mcVersion), [kind]: build });
  }

  return Object.fromEntries(grouped);
}
