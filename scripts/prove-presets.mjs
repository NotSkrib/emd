// Generates every shipped preset from its sample answers and builds the result with Gradle.
// A preset that renders but does not build is a broken preset, and the unit tests cannot see that.
//
//   npm run build
//   node scripts/prove-presets.mjs [--preset <id>] [--gradle <path>] [--keep]
//
// Needs the JDK a preset asks for (Java 25 for current Minecraft releases) and a Gradle new enough
// for the generated build: the generated README says which. Downloads dependencies on first run.
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "dist", "cli.js");
const IN_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";
const NON_APP_JAR = /-(sources|javadoc)\.jar$/;

const { values } = parseArgs({
  options: {
    preset: { type: "string" },
    gradle: { type: "string" },
    keep: { type: "boolean", default: false },
  },
});
const gradle = values.gradle ?? process.env.GRADLE ?? "gradle";

async function importFromDist(file) {
  try {
    return await import(pathToFileURL(path.join(ROOT, "dist", file)).href);
  } catch (error) {
    console.error(`Cannot load dist/${file}. Run \`npm run build\` first.\n${error.message}`);
    process.exit(2);
  }
}

const { loadPresets } = await importFromDist("presets/load.js");
const { sampleAnswers } = await importFromDist("presets/samples.js");

/** Wraps a task's output in a collapsible group on GitHub Actions and a heading elsewhere. */
async function group(title, task) {
  console.log(IN_GITHUB_ACTIONS ? `::group::${title}` : `\n=== ${title}`);
  try {
    return await task();
  } finally {
    if (IN_GITHUB_ACTIONS) console.log("::endgroup::");
  }
}

/** Runs a command with its output shown. `.bat` files need a shell on Windows. */
function runCommand(command, args, cwd) {
  const shell = process.platform === "win32";
  const quote = (text) => (shell && /\s/.test(text) ? `"${text}"` : text);
  const result = spawnSync(quote(command), args.map(quote), { cwd, stdio: "inherit", shell });
  return result.status === 0;
}

async function applicationJars(projectDir) {
  const names = await readdir(path.join(projectDir, "build", "libs")).catch(() => []);
  return names.filter((name) => name.endsWith(".jar") && !NON_APP_JAR.test(name));
}

/** Returns undefined when the preset builds, otherwise what went wrong. */
async function prove(manifest) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), `emd-prove-${manifest.id}-`));
  const projectDir = path.join(workDir, "project");
  try {
    const setArgs = Object.entries(sampleAnswers(manifest)).flatMap(([key, value]) => ["--set", `${key}=${value}`]);
    // A proxy preset is not tied to a Minecraft version, so it is generated without one.
    const mcArgs = manifest.family === "proxy" ? [] : ["--mc", "latest"];
    const generated = runCommand(process.execPath, [CLI, "new", "--preset", manifest.id, ...mcArgs, ...setArgs, "--dir", projectDir], ROOT);
    if (!generated) return "emd new failed";

    const built = runCommand(gradle, ["--no-daemon", "--console=plain", "--warning-mode", "all", "build"], projectDir);
    if (!built) return "gradle build failed";

    const jars = await applicationJars(projectDir);
    return jars.length > 0 ? undefined : "the build produced no jar in build/libs";
  } finally {
    if (values.keep) console.log(`Kept ${workDir}`);
    else await rm(workDir, { recursive: true, force: true });
  }
}

const all = await loadPresets(path.join(ROOT, "presets"));
const presets = all.filter(({ manifest }) => values.preset === undefined || manifest.id === values.preset);
if (presets.length === 0) {
  console.error(values.preset === undefined ? "No presets found." : `No preset named ${JSON.stringify(values.preset)}.`);
  process.exit(2);
}

const failures = [];
for (const { manifest } of presets) {
  const problem = await group(`Build ${manifest.id}`, () => prove(manifest));
  if (problem !== undefined) failures.push(`${manifest.id}: ${problem}`);
  console.log(problem === undefined ? `PASS ${manifest.id}` : `FAIL ${manifest.id}: ${problem}`);
}

console.log(`\n${presets.length - failures.length} of ${presets.length} presets built.`);
if (failures.length > 0) {
  console.error(failures.map((line) => `  ${line}`).join("\n"));
  process.exit(1);
}
