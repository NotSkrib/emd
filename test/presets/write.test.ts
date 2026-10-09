import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeProject } from "../../src/presets/write.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "emd-write-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const FILES = [
  { path: "build.gradle.kts", content: "build" },
  { path: "src/main/java/dev/Main.java", content: "main" },
];

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

describe("writeProject", () => {
  it("creates the folder and any nested folders, and returns the paths in order", async () => {
    const target = path.join(root, "new", "project");

    expect(await writeProject(target, FILES, { force: false })).toEqual(["build.gradle.kts", "src/main/java/dev/Main.java"]);
    expect(await readFile(path.join(target, "src", "main", "java", "dev", "Main.java"), "utf8")).toBe("main");
  });

  it("refuses to overwrite an existing file and writes nothing at all", async () => {
    const target = path.join(root, "project");
    await mkdir(target);
    await writeFile(path.join(target, "build.gradle.kts"), "old");

    expect(await errorCodeOfAsync(() => writeProject(target, FILES, { force: false }))).toBe("CONFLICT");
    expect(await readFile(path.join(target, "build.gradle.kts"), "utf8")).toBe("old");
    expect(await exists(path.join(target, "src"))).toBe(false);
  });

  it("names the files that are in the way", async () => {
    const target = path.join(root, "project");
    await mkdir(target);
    await writeFile(path.join(target, "build.gradle.kts"), "old");

    await expect(writeProject(target, FILES, { force: false })).rejects.toThrow(/build\.gradle\.kts/);
  });

  it("overwrites existing files when forced", async () => {
    const target = path.join(root, "project");
    await mkdir(target);
    await writeFile(path.join(target, "build.gradle.kts"), "old");

    await writeProject(target, FILES, { force: true });

    expect(await readFile(path.join(target, "build.gradle.kts"), "utf8")).toBe("build");
  });

  it("refuses a path that would leave the project folder", async () => {
    const target = path.join(root, "project");

    expect(await errorCodeOfAsync(() => writeProject(target, [{ path: "../escape.txt", content: "x" }], { force: false }))).toBe("BAD_TEMPLATE");
    expect(await exists(path.join(root, "escape.txt"))).toBe(false);
  });

  it("creates an empty folder when there is nothing to write", async () => {
    const target = path.join(root, "empty");

    expect(await writeProject(target, [], { force: false })).toEqual([]);
    expect(await readdir(target)).toEqual([]);
  });
});
