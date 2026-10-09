import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EmdError } from "../errors.js";
import { isRecord } from "../util/json.js";
import { ALLOWED_HOSTS } from "./sources.js";

export type ResponseSource = "network" | "cache" | "stale-cache";

export interface HttpResponse {
  body: string;
  source: ResponseSource;
  /** How old the cached copy is. Only set when the response came from the cache. */
  ageMs?: number;
}

export interface GetOptions {
  /**
   * Throws when the body is unusable. Such a body is never cached, and a previously cached copy is
   * served instead when there is one.
   */
  validate?: (body: string) => void;
}

export interface HttpClient {
  get(url: string, options?: GetOptions): Promise<HttpResponse>;
}

export interface HttpOptions {
  fetch?: typeof fetch;
  /** Where to cache responses. `null` disables the disk cache; leave unset for the default location. */
  cacheDir?: string | null;
  /** Hosts the client may contact. Only https URLs on these hosts are fetched, redirects included. */
  allowedHosts?: readonly string[];
  ttlMs?: number;
  /** A cached copy older than this is never served, even when the network is down. */
  maxStaleMs?: number;
  maxBytes?: number;
  timeoutMs?: number;
  retries?: number;
  /** Skip fresh cache entries and go to the network. */
  refresh?: boolean;
  userAgent?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

type Config = Required<HttpOptions>;

interface CacheEntry {
  fetchedAt: number;
  body: string;
}

type Attempt = { ok: true; body: string } | { ok: false; transient: boolean; error: EmdError };

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_USER_AGENT = "emd-minecraft";
const BACKOFF_MS = 400;
const MAX_REDIRECTS = 3;
const SERVER_ERROR_FLOOR = 500;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const CLOCK_SKEW_MS = 60_000;
/** A cache file holds the body as a JSON string, which can be several times larger than the body. */
const CACHE_FILE_SIZE_FACTOR = 8;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const GROUP_OR_OTHER_WRITABLE = 0o022;
const MAX_SHOWN_URL_LENGTH = 200;

/** `$EMD_CACHE_DIR`, else `~/.emd/cache`. Null when no home directory can be determined. */
export function defaultCacheDir(): string | null {
  const fromEnv = process.env.EMD_CACHE_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  try {
    return path.join(os.homedir(), ".emd", "cache");
  } catch {
    return null; // No home directory, so no cache. A shared temp directory would be worse.
  }
}

export function cacheFileName(url: string): string {
  return `${createHash("sha256").update(url).digest("hex").slice(0, 32)}.json`;
}

/**
 * GET client for the version APIs. It only talks https to an allow-list of hosts, follows at most
 * three redirects (each re-checked), caps response size, and keeps a private disk cache. Fresh
 * entries are served without touching the network. When the network is down or the response is
 * unusable, a cached copy younger than `maxStaleMs` is served and reported as "stale-cache".
 */
export function createHttpClient(options: HttpOptions = {}): HttpClient {
  const config = resolveConfig(options);
  let cacheReady: Promise<boolean> | undefined;
  const cacheUsable = (): Promise<boolean> => {
    cacheReady ??= prepareCache(config.cacheDir);
    return cacheReady;
  };
  return { get: (url, getOptions = {}) => getWithCache(config, cacheUsable, url, getOptions) };
}

function resolveConfig(options: HttpOptions): Config {
  return {
    fetch: options.fetch ?? fetch,
    cacheDir: options.cacheDir === undefined ? defaultCacheDir() : options.cacheDir,
    allowedHosts: options.allowedHosts ?? ALLOWED_HOSTS,
    ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
    maxStaleMs: options.maxStaleMs ?? DEFAULT_MAX_STALE_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: options.retries ?? DEFAULT_RETRIES,
    refresh: options.refresh ?? false,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    now: options.now ?? Date.now,
    sleep: options.sleep ?? defaultSleep,
  };
}

async function getWithCache(
  config: Config,
  cacheUsable: () => Promise<boolean>,
  rawUrl: string,
  options: GetOptions,
): Promise<HttpResponse> {
  const url = assertAllowedUrl(rawUrl, config.allowedHosts).href;
  const name = cacheFileName(url);
  const dir = config.cacheDir !== null && (await cacheUsable()) ? config.cacheDir : null;
  const cached = dir === null ? undefined : await readCache(config, dir, name);
  const age = cached === undefined ? undefined : Math.max(0, config.now() - cached.fetchedAt);

  if (cached && age !== undefined && !config.refresh && age < config.ttlMs) {
    return { body: cached.body, source: "cache", ageMs: age };
  }

  const outcome = await fetchValidated(config, url, options);
  if (outcome.ok) {
    if (dir !== null) await writeCache(dir, name, { fetchedAt: config.now(), body: outcome.body });
    return { body: outcome.body, source: "network" };
  }
  if (cached && age !== undefined && outcome.transient && age <= config.maxStaleMs) {
    return { body: cached.body, source: "stale-cache", ageMs: age };
  }
  throw outcome.error;
}

/** Fetches, then runs the caller's validator. An unusable 200, such as a proxy's error page, counts as transient. */
async function fetchValidated(config: Config, url: string, options: GetOptions): Promise<Attempt> {
  const outcome = await fetchWithRetry(config, url);
  if (!outcome.ok || options.validate === undefined) return outcome;
  try {
    options.validate(outcome.body);
    return outcome;
  } catch (cause) {
    const error = cause instanceof EmdError ? cause : new EmdError("BAD_RESPONSE", `${url} returned an unusable body.`, { cause });
    return { ok: false, transient: true, error };
  }
}

async function fetchWithRetry(config: Config, url: string): Promise<Attempt> {
  let last: Attempt = { ok: false, transient: true, error: new EmdError("NETWORK", `Could not reach ${url}.`) };
  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    if (attempt > 0) await config.sleep(BACKOFF_MS * 2 ** (attempt - 1));
    last = await attemptOnce(config, url);
    if (last.ok || !last.transient) return last;
  }
  return last;
}

async function attemptOnce(config: Config, url: string): Promise<Attempt> {
  try {
    const response = await requestFollowingRedirects(config, url);
    if (response.ok) return { ok: true, body: await readCapped(response, url, config.maxBytes) };
    return {
      ok: false,
      transient: isTransientStatus(response.status),
      error: new EmdError("HTTP_STATUS", `${url} responded with HTTP ${response.status}.`),
    };
  } catch (cause) {
    if (cause instanceof EmdError) return { ok: false, transient: false, error: cause };
    return { ok: false, transient: true, error: new EmdError("NETWORK", `Could not reach ${url}.`, { cause }) };
  }
}

/** Follows redirects by hand so that every hop is checked against the same allow-list. */
async function requestFollowingRedirects(config: Config, startUrl: string): Promise<Response> {
  let current = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await config.fetch(current.href, {
      redirect: "manual",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: { "user-agent": config.userAgent },
    });
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get("location") : null;
    if (location === null) return response;
    await response.body?.cancel();
    current = assertAllowedUrl(resolveLocation(location, current), config.allowedHosts);
  }
  throw new EmdError("HTTP_STATUS", `Too many redirects starting from ${startUrl}.`);
}

function isTransientStatus(status: number): boolean {
  return status >= SERVER_ERROR_FLOOR || status === HTTP_REQUEST_TIMEOUT || status === HTTP_TOO_MANY_REQUESTS;
}

function assertAllowedUrl(raw: string, allowedHosts: readonly string[]): URL {
  const url = parseUrl(raw);
  const allowed =
    url !== undefined &&
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    allowedHosts.includes(url.hostname);
  if (!allowed) {
    throw new EmdError(
      "BAD_URL",
      `Refusing to fetch ${JSON.stringify(raw.slice(0, MAX_SHOWN_URL_LENGTH))}: only https URLs on known Minecraft hosts are allowed.`,
    );
  }
  return url;
}

function parseUrl(raw: string, base?: URL): URL | undefined {
  try {
    return new URL(raw, base);
  } catch {
    return undefined;
  }
}

function resolveLocation(location: string, base: URL): string {
  return parseUrl(location, base)?.href ?? location;
}

/** Reads the body, refusing anything larger than `maxBytes`, whether declared up front or streamed. */
async function readCapped(response: Response, url: string, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(url, maxBytes);
  if (response.body === null) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw tooLarge(url, maxBytes);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function tooLarge(url: string, maxBytes: number): EmdError {
  return new EmdError("TOO_LARGE", `${url} is larger than ${maxBytes} bytes.`);
}

async function prepareCache(dir: string | null): Promise<boolean> {
  if (dir === null) return false;
  try {
    await mkdir(dir, { recursive: true, mode: PRIVATE_DIR_MODE });
    return await isPrivateDirectory(dir);
  } catch {
    return false; // An unusable cache directory just means there is no cache.
  }
}

/** On POSIX the cache must be a real directory we own that others cannot write to. Windows has no such mode bits. */
async function isPrivateDirectory(dir: string): Promise<boolean> {
  const info = await lstat(dir);
  if (!info.isDirectory()) return false;
  const uid = process.getuid?.();
  return uid === undefined || (info.uid === uid && (info.mode & GROUP_OR_OTHER_WRITABLE) === 0);
}

async function readCache(config: Config, dir: string, name: string): Promise<CacheEntry | undefined> {
  try {
    const file = path.join(dir, name);
    const info = await lstat(file);
    if (!info.isFile() || info.size > config.maxBytes * CACHE_FILE_SIZE_FACTOR) return undefined;

    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!isRecord(parsed) || typeof parsed.body !== "string" || typeof parsed.fetchedAt !== "number") return undefined;
    const { fetchedAt, body } = parsed;
    const plausible = Number.isFinite(fetchedAt) && fetchedAt > 0 && fetchedAt <= config.now() + CLOCK_SKEW_MS;
    return plausible ? { fetchedAt, body } : undefined;
  } catch {
    return undefined; // A missing, unreadable or corrupt entry is a cache miss, not an error.
  }
}

async function writeCache(dir: string, name: string, entry: CacheEntry): Promise<void> {
  try {
    await replaceFile(path.join(dir, name), JSON.stringify(entry));
  } catch {
    // The cache is an optimisation; failing to write it must not break a lookup.
  }
}

/** Writes to a private temporary file and renames it into place, so readers never see a partial file. */
async function replaceFile(target: string, content: string): Promise<void> {
  const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, content, { mode: PRIVATE_FILE_MODE, flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
