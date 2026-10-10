import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadContent } from "../../src/install/content.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "emd-content-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

async function put(relative: string, content: string): Promise<void> {
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

const skillMd = (name: string, description = "Does a thing. Use when asked."): string =>
  `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n# ${name}\n\nBody.\n`;

const agentMd = (name: string, extra = ""): string =>
  `---\nname: ${name}\ndescription: "Reviews things."\n${extra}---\nYou review things.\n`;

describe("loadContent", () => {
  it("loads skills with their extra files and agents, sorted by name", async () => {
    await put("skills/emd-b/SKILL.md", skillMd("emd-b"));
    await put("skills/emd-a/SKILL.md", skillMd("emd-a"));
    await put("skills/emd-a/references/FACTS.md", "# Facts\n");
    await put("agents/emd-z.md", agentMd("emd-z", "readonly: true\n"));
    await put("agents/emd-y.md", agentMd("emd-y"));

    const content = await loadContent(root);

    expect(content.skills.map((skill) => skill.name)).toEqual(["emd-a", "emd-b"]);
    expect(content.skills[0]?.files.map((file) => file.path).sort()).toEqual(["SKILL.md", "references/FACTS.md"]);
    expect(content.skills[0]?.description).toBe("Does a thing. Use when asked.");
    expect(content.agents.map((agent) => [agent.name, agent.readonly])).toEqual([["emd-y", false], ["emd-z", true]]);
    expect(content.agents[0]?.body).toBe("You review things.\n");
  });

  it("returns nothing when the folders are absent", async () => {
    expect(await loadContent(root)).toEqual({ skills: [], agents: [] });
  });

  it.each([
    ["a name without the emd- prefix", "other-skill"],
    ["uppercase", "emd-Skill"],
    ["a double hyphen", "emd--skill"],
    ["a trailing hyphen", "emd-skill-"],
    ["an underscore", "emd_skill"],
    ["more than 64 characters", `emd-${"a".repeat(61)}`],
  ])("rejects a skill folder with %s", async (_label, name) => {
    await put(`skills/${name}/SKILL.md`, skillMd(name));

    expect(await errorCodeOfAsync(() => loadContent(root))).toBe("BAD_CONTENT");
  });

  it("rejects a skill whose name differs from its folder", async () => {
    await put("skills/emd-a/SKILL.md", skillMd("emd-b"));

    await expect(loadContent(root)).rejects.toThrow(/must match the folder/);
  });

  it("rejects a missing SKILL.md", async () => {
    await put("skills/emd-a/references/X.md", "x");

    await expect(loadContent(root)).rejects.toThrow(/SKILL\.md/);
  });

  it.each([
    ["an empty description", ""],
    ["a description over 1024 characters", "x".repeat(1025)],
    ["a multi-line description", "line one\nline two"],
  ])("rejects a skill with %s", async (_label, description) => {
    await put("skills/emd-a/SKILL.md", `---\nname: emd-a\ndescription: ${JSON.stringify(description)}\n---\nbody\n`);

    expect(await errorCodeOfAsync(() => loadContent(root))).toBe("BAD_CONTENT");
  });

  it("rejects a header field the spec subset does not use", async () => {
    await put("skills/emd-a/SKILL.md", "---\nname: emd-a\ndescription: ok\nallowed-tools: Bash\n---\nbody\n");

    await expect(loadContent(root)).rejects.toThrow(/allowed-tools/);
  });

  it("accepts a license field", async () => {
    await put("skills/emd-a/SKILL.md", "---\nname: emd-a\ndescription: ok\nlicense: MIT\n---\nbody\n");

    expect((await loadContent(root)).skills).toHaveLength(1);
  });

  it("rejects a SKILL.md of more than 500 lines", async () => {
    await put("skills/emd-a/SKILL.md", `${skillMd("emd-a")}${"line\n".repeat(500)}`);

    await expect(loadContent(root)).rejects.toThrow(/500 lines/);
  });

  it("rejects a binary file and a hidden file in a skill", async () => {
    await put("skills/emd-a/SKILL.md", skillMd("emd-a"));
    await put("skills/emd-a/assets/blob.bin", "a\u0000b");
    await expect(loadContent(root)).rejects.toThrow(/binary/);

    await rm(path.join(root, "skills", "emd-a", "assets"), { recursive: true });
    await put("skills/emd-a/.hidden", "x");
    await expect(loadContent(root)).rejects.toThrow(/hidden/);
  });

  it("rejects a skill with too many files", async () => {
    await put("skills/emd-a/SKILL.md", skillMd("emd-a"));
    for (let index = 0; index < 50; index += 1) await put(`skills/emd-a/references/r${index}.md`, "x");

    await expect(loadContent(root)).rejects.toThrow(/more than 50 files/);
  });

  it("rejects a link inside a skill", async (context) => {
    await put("skills/emd-a/SKILL.md", skillMd("emd-a"));
    await put("outside.txt", "secret");
    const link = path.join(root, "skills", "emd-a", "link.md");
    try {
      await symlink(path.join(root, "outside.txt"), link);
    } catch {
      context.skip(); // Creating links needs extra privileges on some systems.
    }

    try {
      await expect(loadContent(root)).rejects.toThrow(/link/);
    } finally {
      await unlink(link); // Recursive cleanup of a tree holding a link is unreliable on Windows.
    }
  });

  it("rejects an agent whose name differs from its file, lacks the prefix, or has an unknown field", async () => {
    await put("agents/emd-a.md", agentMd("emd-b"));
    await expect(loadContent(root)).rejects.toThrow(/must match the file name/);

    await rm(path.join(root, "agents", "emd-a.md"));
    await put("agents/plain.md", agentMd("plain"));
    expect(await errorCodeOfAsync(() => loadContent(root))).toBe("BAD_CONTENT");

    await rm(path.join(root, "agents", "plain.md"));
    await put("agents/emd-c.md", agentMd("emd-c", "tools: Read\n"));
    await expect(loadContent(root)).rejects.toThrow(/tools/);
  });

  it("rejects an agent with an empty body or a non-boolean readonly", async () => {
    await put("agents/emd-a.md", '---\nname: emd-a\ndescription: "x"\n---\n\n');
    await expect(loadContent(root)).rejects.toThrow(/no instructions/);

    await rm(path.join(root, "agents", "emd-a.md"));
    await put("agents/emd-b.md", agentMd("emd-b", 'readonly: "yes"\n'));
    await expect(loadContent(root)).rejects.toThrow(/readonly/);
  });

  it("ignores files in the agents folder that are not markdown", async () => {
    await put("agents/notes.txt", "ignore me");
    await put("agents/emd-a.md", agentMd("emd-a"));

    expect((await loadContent(root)).agents.map((agent) => agent.name)).toEqual(["emd-a"]);
  });
});
