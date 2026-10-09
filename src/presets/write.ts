import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { EmdError } from "../errors.js";
import type { PlannedFile } from "./types.js";

export interface WriteOptions {
  /** Overwrite files that already exist. Without it, any existing file stops the whole write. */
  force: boolean;
}

interface Target {
  file: PlannedFile;
  full: string;
}

/**
 * Writes planned files under `targetDir`, creating it if needed, and returns the relative paths.
 * Everything is checked before the first byte is written: no file may already exist (unless
 * `force`), no path may leave the folder, and no folder on the way may be a link that leads out.
 */
export async function writeProject(targetDir: string, files: readonly PlannedFile[], options: WriteOptions): Promise<string[]> {
  const root = path.resolve(targetDir);
  await mkdir(root, { recursive: true });
  const realRoot = await realpath(root);

  const targets = files.map((file): Target => ({ file, full: path.join(realRoot, ...file.path.split("/")) }));
  targets.forEach(({ full }) => assertInside(realRoot, full));
  await assertNoConflicts(targets, options.force);

  for (const { file, full } of targets) {
    await mkdir(path.dirname(full), { recursive: true });
    assertInside(realRoot, await realpath(path.dirname(full)));
    await writeFile(full, file.content, { flag: options.force ? "w" : "wx" });
  }
  return files.map((file) => file.path);
}

async function assertNoConflicts(targets: readonly Target[], force: boolean): Promise<void> {
  const found = await Promise.all(
    targets.map(async ({ file, full }) => ({ path: file.path, info: await lstat(full).catch(() => undefined) })),
  );
  const links = found.filter((entry) => entry.info?.isSymbolicLink() === true).map((entry) => entry.path);
  if (links.length > 0) throw new EmdError("CONFLICT", `These paths are links, and EMD will not write through links: ${links.join(", ")}.`);

  const existing = found.filter((entry) => entry.info !== undefined).map((entry) => entry.path);
  if (!force && existing.length > 0) {
    throw new EmdError("CONFLICT", `These files already exist: ${existing.join(", ")}. Use --force to overwrite them, or choose another folder.`);
  }
}

function assertInside(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new EmdError("BAD_TEMPLATE", `Refusing to write outside the project folder: ${JSON.stringify(candidate)}.`);
  }
}
