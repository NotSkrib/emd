// Records trimmed copies of the real version APIs into test/fixtures.
// Run with `npm run record-fixtures`. The tests assert on shape and invariants rather than on
// exact numbers, so re-recording against newer data is safe.
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
// Everything is written here first and swapped into place at the end, so a failed run leaves the
// previous fixtures untouched.
const STAGE = `${OUT}.staging`;

const SOURCES = {
  mojangManifest: ["https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", "mojang-manifest.json"],
  fillPaper: ["https://fill.papermc.io/v3/projects/paper", "fill-paper.json"],
  fillFolia: ["https://fill.papermc.io/v3/projects/folia", "fill-folia.json"],
  paperApiMeta: [
    "https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/maven-metadata.xml",
    "paper-api-maven-metadata.xml",
  ],
  velocityApiMeta: [
    "https://repo.papermc.io/repository/maven-public/com/velocitypowered/velocity-api/maven-metadata.xml",
    "velocity-api-maven-metadata.xml",
  ],
  fabricGame: ["https://meta.fabricmc.net/v2/versions/game", "fabric-game.json"],
  fabricLoader: ["https://meta.fabricmc.net/v2/versions/loader", "fabric-loader.json"],
  fabricApiMeta: [
    "https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/maven-metadata.xml",
    "fabric-api-maven-metadata.xml",
  ],
  loomMeta: ["https://maven.fabricmc.net/net/fabricmc/fabric-loom/maven-metadata.xml", "fabric-loom-maven-metadata.xml"],
  neoForge: ["https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge", "neoforge-versions.json"],
  forgePromos: ["https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json", "forge-promotions.json"],
  gradle: ["https://services.gradle.org/versions/current", "gradle-current.json"],
  moddevgradleMeta: [
    "https://plugins.gradle.org/m2/net/neoforged/moddev/net.neoforged.moddev.gradle.plugin/maven-metadata.xml",
    "moddevgradle-maven-metadata.xml",
  ],
};

const SAFE_MC_ID = /^\d+(\.\d+){1,2}$/;
const SAFE_VERSION_TOKEN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;
const MOJANG_METADATA_PREFIX = "https://piston-meta.mojang.com/";
const KEEP_MOJANG_IDS = new Set(["26.2", "26.1.2", "1.21.11", "1.21.1", "1.12.2"]);
const MOJANG_VERSION_FIXTURES = ["1.21.11", "1.12.2"];
const KEEP_FABRIC_GAME_IDS = new Set(["1.21.11", "1.20.4"]);
const FABRIC_API_BUILDS_PER_MC_VERSION = 10;

async function get(url, asJson) {
  const res = await fetch(url, {
    headers: { "user-agent": "emd-fixture-recorder" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return asJson ? res.json() : res.text();
}

const mavenVersions = (xml) => [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);

function mavenXml(versions, release) {
  const list = versions.map((v) => `      <version>${v}</version>`).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<metadata>",
    "  <versioning>",
    `    <latest>${release}</latest>`,
    `    <release>${release}</release>`,
    "    <versions>",
    list,
    "    </versions>",
    "  </versioning>",
    "</metadata>",
    "",
  ].join("\n");
}

const lastOf = (list, n) => list.slice(Math.max(0, list.length - n));
const suffixOf = (version) => version.slice(version.lastIndexOf("+") + 1);

function stagedPath(name) {
  const target = path.join(STAGE, name);
  if (path.dirname(target) !== STAGE) throw new Error(`Refusing to write outside the staging directory: ${name}`);
  return target;
}

const writeJson = (name, value) => writeFile(stagedPath(name), `${JSON.stringify(value, null, 2)}\n`);
const writeText = (name, value) => writeFile(stagedPath(name), value);

async function recordMojang() {
  const [url, file] = SOURCES.mojangManifest;
  const manifest = await get(url, true);
  const latest = manifest.latest.release;
  const keep = manifest.versions.filter((v, i) => i < 12 || v.id === latest || KEEP_MOJANG_IDS.has(v.id));
  await writeJson(file, { latest: manifest.latest, versions: keep });

  for (const id of new Set([latest, ...MOJANG_VERSION_FIXTURES])) {
    if (!SAFE_MC_ID.test(id)) throw new Error(`Refusing unexpected Minecraft version id ${JSON.stringify(id)}`);
    const entry = manifest.versions.find((v) => v.id === id);
    if (!entry) continue;
    if (!String(entry.url).startsWith(MOJANG_METADATA_PREFIX)) {
      throw new Error(`Refusing to fetch version metadata from ${JSON.stringify(entry.url)}`);
    }
    const full = await get(entry.url, true);
    const trimmed = { id: full.id, type: full.type, releaseTime: full.releaseTime };
    if (full.javaVersion) {
      trimmed.javaVersion = { component: full.javaVersion.component, majorVersion: full.javaVersion.majorVersion };
    }
    await writeJson(`mojang-version-${id}.json`, trimmed);
  }
}

async function recordMaven(key, pick) {
  const [url, file] = SOURCES[key];
  const xml = await get(url, false);
  const kept = pick(mavenVersions(xml));
  const release = /<release>([^<]+)<\/release>/.exec(xml)?.[1] ?? kept[kept.length - 1];
  await writeText(file, mavenXml(kept, release));
}

/** The newest few builds of every Minecraft version we care about, so no version is crowded out by newer ones. */
function pickFabricApi(all) {
  const wanted = (suffix) => /^26\./.test(suffix) || KEEP_FABRIC_GAME_IDS.has(suffix);
  const bySuffix = new Map();
  for (const version of all) {
    const suffix = suffixOf(version);
    if (wanted(suffix)) bySuffix.set(suffix, [...(bySuffix.get(suffix) ?? []), version]);
  }
  return [...bySuffix.values()].flatMap((builds) => lastOf(builds, FABRIC_API_BUILDS_PER_MC_VERSION));
}

/** The Gradle module metadata of the newest stable Velocity API, trimmed to what the parser reads. */
async function recordVelocityModule() {
  const [url] = SOURCES.velocityApiMeta;
  const release = /<release>([^<]+)<\/release>/.exec(await get(url, false))?.[1];
  if (!release || !SAFE_VERSION_TOKEN.test(release)) throw new Error(`Refusing unexpected Velocity release ${JSON.stringify(release)}`);
  const full = await get(url.replace("maven-metadata.xml", `${release}/velocity-api-${release}.module`), true);
  const variants = full.variants.map((variant) => ({ name: variant.name, attributes: variant.attributes }));
  await writeJson("velocity-api-module.json", { formatVersion: full.formatVersion, component: full.component, variants });
}

async function recordNeoForge() {
  const [url, file] = SOURCES.neoForge;
  const neo = await get(url, true);
  const startsWith = (prefix) => neo.versions.filter((v) => v.startsWith(prefix));
  const kept = [
    ...neo.versions.filter((v) => v.includes("craftmine")).slice(0, 2),
    ...startsWith("20.4.").slice(-2),
    ...startsWith("21.0.").slice(-2),
    ...startsWith("21.1.").slice(-3),
    ...startsWith("21.11.").slice(-3),
    ...startsWith("26."),
  ];
  await writeJson(file, { isSnapshot: false, versions: [...new Set(kept)] });
}

async function recordForge() {
  const [url, file] = SOURCES.forgePromos;
  const forge = await get(url, true);
  const promos = Object.fromEntries(
    Object.entries(forge.promos).filter(([key]) => /^26\./.test(key) || /^(1\.21\.11|1\.20\.1|1\.12\.2)-/.test(key)),
  );
  await writeJson(file, { homepage: forge.homepage, promos });
}

async function main() {
  await rm(STAGE, { recursive: true, force: true });
  await mkdir(STAGE, { recursive: true });
  await recordMojang();

  for (const key of ["fillPaper", "fillFolia", "gradle"]) {
    const [url, file] = SOURCES[key];
    await writeJson(file, await get(url, true));
  }

  const [moddevUrl, moddevFile] = SOURCES.moddevgradleMeta;
  await writeText(moddevFile, await get(moddevUrl, false));

  await recordMaven("paperApiMeta", (all) =>
    all.filter((v) => /^26\./.test(v) || /^1\.21\.11/.test(v) || v === "1.21.1-R0.1-SNAPSHOT" || v === "1.20.4-R0.1-SNAPSHOT"),
  );
  await recordMaven("velocityApiMeta", (all) => lastOf(all, 20));
  await recordVelocityModule();
  await recordMaven("loomMeta", (all) => lastOf(all, 25));
  await recordMaven("fabricApiMeta", pickFabricApi);

  const [gameUrl, gameFile] = SOURCES.fabricGame;
  const game = await get(gameUrl, true);
  await writeJson(gameFile, game.filter((v, i) => i < 20 || KEEP_FABRIC_GAME_IDS.has(v.version)));
  const [loaderUrl, loaderFile] = SOURCES.fabricLoader;
  await writeJson(loaderFile, (await get(loaderUrl, true)).slice(0, 8));

  await recordNeoForge();
  await recordForge();

  await rm(OUT, { recursive: true, force: true });
  await rename(STAGE, OUT);
  console.log(`Recorded fixtures into ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
