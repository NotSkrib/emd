import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRegularText } from "../../src/util/files.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "emd-files-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("readRegularText", () => {
  it("reads a regular file as UTF-8", async () => {
    await writeFile(path.join(dir, "a.txt"), "héllo\n");

    expect(await readRegularText(path.join(dir, "a.txt"), 100, "a.txt", "BAD_CONTENT")).toBe("héllo\n");
  });

  it("reports a missing file with the error code it was given", async () => {
    expect(await errorCodeOfAsync(() => readRegularText(path.join(dir, "none.txt"), 100, "none.txt", "BAD_CONTENT"))).toBe("BAD_CONTENT");
    expect(await errorCodeOfAsync(() => readRegularText(path.join(dir, "none.txt"), 100, "none.txt", "BAD_PRESET"))).toBe("BAD_PRESET");
  });

  it("refuses a folder", async () => {
    await mkdir(path.join(dir, "sub"));

    await expect(readRegularText(path.join(dir, "sub"), 100, "sub", "BAD_CONTENT")).rejects.toThrow(/regular file/);
  });

  it("refuses a file over the limit and accepts one at the limit", async () => {
    await writeFile(path.join(dir, "big.txt"), "x".repeat(11));
    await writeFile(path.join(dir, "ok.txt"), "x".repeat(10));

    await expect(readRegularText(path.join(dir, "big.txt"), 10, "big.txt", "BAD_CONTENT")).rejects.toThrow(/larger than 10 bytes/);
    expect(await readRegularText(path.join(dir, "ok.txt"), 10, "ok.txt", "BAD_CONTENT")).toHaveLength(10);
  });

  it("refuses a symbolic link, so a planted link cannot point the read elsewhere", async (context) => {
    await writeFile(path.join(dir, "target.txt"), "secret");
    const link = path.join(dir, "link.txt");
    try {
      await symlink(path.join(dir, "target.txt"), link);
    } catch {
      context.skip(); // Creating links needs extra privileges on some systems.
    }

    try {
      await expect(readRegularText(link, 100, "link.txt", "BAD_CONTENT")).rejects.toThrow(/regular file/);
    } finally {
      await unlink(link); // Recursive cleanup of a tree holding a link is unreliable on Windows.
    }
  });
});
