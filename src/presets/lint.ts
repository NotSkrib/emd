import type { PresetManifest } from "./types.js";

/** Licences whose code may be copied into a preset. Anything else is reference reading only. */
export const PERMISSIVE_LICENSES: ReadonlySet<string> = new Set([
  "MIT",
  "Apache-2.0",
  "CC0-1.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "Unlicense",
]);

/** The rules every shipped preset must pass. CI fails on any problem returned here. */
export function lintManifest(manifest: PresetManifest): string[] {
  const prefix = `Preset ${manifest.id}`;
  const notPermissive = manifest.provenance
    .filter((entry) => entry.use === "derived" && !PERMISSIVE_LICENSES.has(entry.license))
    .map(
      (entry) =>
        `${prefix} derives from ${entry.repo ?? "an unknown repo"} under ${entry.license}, which is not a permissive licence. Mark it "reference" and write the files from scratch.`,
    );
  const unexplained =
    manifest.files.length > 0 && manifest.provenance.length === 0
      ? [`${prefix} has files but no provenance. Record where it came from, or mark it "original".`]
      : [];
  return [...notPermissive, ...unexplained];
}
