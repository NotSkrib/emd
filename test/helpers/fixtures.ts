import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EmdError } from "../../src/errors.js";
import type { HttpClient, HttpResponse } from "../../src/versions/http.js";
import { SOURCE_URLS, type SourceName } from "../../src/versions/sources.js";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Recorded response file for each version source. Written by scripts/record-fixtures.mjs. */
export const FIXTURE_FILES: Record<SourceName, string> = {
  mojangManifest: "mojang-manifest.json",
  fillPaper: "fill-paper.json",
  fillFolia: "fill-folia.json",
  paperApiMeta: "paper-api-maven-metadata.xml",
  velocityApiMeta: "velocity-api-maven-metadata.xml",
  fabricGame: "fabric-game.json",
  fabricLoader: "fabric-loader.json",
  fabricApiMeta: "fabric-api-maven-metadata.xml",
  loomMeta: "fabric-loom-maven-metadata.xml",
  neoForge: "neoforge-versions.json",
  forgePromos: "forge-promotions.json",
  gradle: "gradle-current.json",
  moddevgradleMeta: "moddevgradle-maven-metadata.xml",
};

export function fixtureText(name: string): string {
  return readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixtureText(name));
}

/** An HttpClient that answers from recorded fixtures. `overrides` replaces the response for a URL. */
export function fixtureHttp(overrides: Record<string, HttpResponse> = {}): HttpClient {
  const byUrl = new Map<string, string>(
    (Object.keys(SOURCE_URLS) as SourceName[]).map((name): [string, string] => [SOURCE_URLS[name], FIXTURE_FILES[name]]),
  );
  return {
    async get(url: string): Promise<HttpResponse> {
      const override = overrides[url];
      if (override) return override;
      const file = byUrl.get(url) ?? mojangVersionFixture(url) ?? velocityModuleFixture(url);
      if (!file) throw new EmdError("NETWORK", `No fixture recorded for ${url}`);
      return { body: fixtureText(file), source: "network" };
    },
  };
}

/** Every Velocity API version answers with the recorded 4.2.0 module, so tests rely on its shape, not on one version number. */
function velocityModuleFixture(url: string): string | undefined {
  return /\/velocity-api-[^/]+\.module$/.test(url) ? "velocity-api-module.json" : undefined;
}

function mojangVersionFixture(url: string): string | undefined {
  const id = /\/([^/]+)\.json$/.exec(url)?.[1];
  const file = id ? `mojang-version-${id}.json` : undefined;
  return file && existsSync(path.join(FIXTURE_DIR, file)) ? file : undefined;
}

export function errorCodeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof EmdError ? error.code : `not-an-EmdError: ${String(error)}`;
  }
  return undefined;
}

export async function errorCodeOfAsync(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof EmdError ? error.code : `not-an-EmdError: ${String(error)}`;
  }
  return undefined;
}
