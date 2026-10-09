import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmdError } from "../../src/errors.js";
import { cacheFileName, createHttpClient, type HttpOptions } from "../../src/versions/http.js";
import { errorCodeOfAsync } from "../helpers/fixtures.js";

const URL_A = "https://example.test/a";
const HOST = "example.test";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "emd-http-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ok = (body: string): Response => new Response(body, { status: 200 });
const failing = (status: number): Response => new Response("nope", { status });
const redirect = (location: string): Response => new Response(null, { status: 302, headers: { location } });
const noSleep = async (): Promise<void> => {};

function client(options: HttpOptions): ReturnType<typeof createHttpClient> {
  return createHttpClient({ allowedHosts: [HOST], sleep: noSleep, now: () => 1_000, retries: 0, ...options });
}

describe("cache", () => {
  it("fetches from the network, then serves the cache while it is fresh", async () => {
    const fetchFn = vi.fn(async () => ok("hello"));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000 });

    expect(await http.get(URL_A)).toEqual({ body: "hello", source: "network" });
    expect(await http.get(URL_A)).toEqual({ body: "hello", source: "cache", ageMs: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("refetches once the entry is older than the ttl", async () => {
    let now = 1_000;
    const fetchFn = vi.fn(async () => ok("hello"));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000, now: () => now });

    await http.get(URL_A);
    now += 61_000;
    expect((await http.get(URL_A)).source).toBe("network");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("skips a fresh entry when refresh is set", async () => {
    const fetchFn = vi.fn(async () => ok("hello"));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000, refresh: true });

    await http.get(URL_A);
    expect((await http.get(URL_A)).source).toBe("network");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("serves a stale entry when the network fails, and says how old it is", async () => {
    let now = 1_000;
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(ok("hello")).mockRejectedValue(new TypeError("fetch failed"));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000, now: () => now });

    await http.get(URL_A);
    now += 61_000;
    expect(await http.get(URL_A)).toEqual({ body: "hello", source: "stale-cache", ageMs: 61_000 });
  });

  it("serves a stale entry after a rate limit", async () => {
    let now = 1_000;
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(ok("hello")).mockResolvedValue(failing(429));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000, now: () => now });

    await http.get(URL_A);
    now += 61_000;
    expect((await http.get(URL_A)).source).toBe("stale-cache");
  });

  it("does not serve a stale entry after a permanent error such as 404", async () => {
    let now = 1_000;
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(ok("hello")).mockResolvedValue(failing(404));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000, now: () => now });

    await http.get(URL_A);
    now += 61_000;
    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("HTTP_STATUS");
  });

  it("does not serve an entry older than the maximum stale age", async () => {
    let now = 1_000;
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(ok("hello")).mockRejectedValue(new TypeError("fetch failed"));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 10_000, maxStaleMs: 50_000, now: () => now });

    await http.get(URL_A);
    now = 200_000;
    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("NETWORK");
  });

  it("keeps separate entries per URL", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => ok(`body of ${String(url)}`));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000 });

    await http.get("https://example.test/one");
    await http.get("https://example.test/two");
    expect((await http.get("https://example.test/one")).body).toBe("body of https://example.test/one");
    expect((await readdir(dir)).length).toBe(2);
  });

  it("leaves no temporary files behind", async () => {
    const http = client({ fetch: async () => ok("hello"), cacheDir: dir });

    await http.get(URL_A);
    const files = await readdir(dir);
    expect(files.length).toBe(1);
    expect(files.every((file) => file.endsWith(".json"))).toBe(true);
  });

  it("ignores a corrupt cache file", async () => {
    await writeFile(path.join(dir, cacheFileName(URL_A)), "{ not json");
    const http = client({ fetch: async () => ok("fresh"), cacheDir: dir });

    expect(await http.get(URL_A)).toEqual({ body: "fresh", source: "network" });
  });

  it.each([
    ["a timestamp that is not finite", '{"fetchedAt":1e999,"body":"poisoned"}'],
    ["a timestamp in the future", '{"fetchedAt":9000000000000,"body":"poisoned"}'],
    ["a timestamp that is not positive", '{"fetchedAt":0,"body":"poisoned"}'],
  ])("ignores a cache entry with %s", async (_label, entry) => {
    await writeFile(path.join(dir, cacheFileName(URL_A)), entry);
    const http = client({ fetch: async () => ok("fresh"), cacheDir: dir, ttlMs: 60_000 });

    expect(await http.get(URL_A)).toEqual({ body: "fresh", source: "network" });
  });

  it("does not write to disk without a cache directory", async () => {
    const http = client({ fetch: async () => ok("hello"), cacheDir: null });

    await http.get(URL_A);
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("validation", () => {
  const rejectHtml = (body: string): void => {
    if (body.includes("<html>")) throw new EmdError("BAD_RESPONSE", "not metadata");
  };

  it("does not cache a body that fails validation", async () => {
    const http = client({ fetch: async () => ok("<html>maintenance</html>"), cacheDir: dir });

    expect(await errorCodeOfAsync(() => http.get(URL_A, { validate: rejectHtml }))).toBe("BAD_RESPONSE");
    expect(await readdir(dir)).toEqual([]);
  });

  it("serves the previous copy when a new body fails validation", async () => {
    let now = 1_000;
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(ok("good")).mockResolvedValueOnce(ok("<html>maintenance</html>"));
    const http = client({ fetch: fetchFn, cacheDir: dir, ttlMs: 60_000, now: () => now });

    await http.get(URL_A, { validate: rejectHtml });
    now += 61_000;
    expect(await http.get(URL_A, { validate: rejectHtml })).toEqual({ body: "good", source: "stale-cache", ageMs: 61_000 });
  });
});

describe("failures", () => {
  it("retries server errors and then succeeds", async () => {
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(failing(503)).mockResolvedValueOnce(ok("fine"));
    const sleep = vi.fn(noSleep);
    const http = client({ fetch: fetchFn, cacheDir: null, retries: 2, sleep });

    expect(await http.get(URL_A)).toEqual({ body: "fine", source: "network" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it.each([408, 429])("retries HTTP %i", async (status) => {
    const fetchFn = vi.fn<() => Promise<Response>>().mockResolvedValueOnce(failing(status)).mockResolvedValueOnce(ok("fine"));
    const http = client({ fetch: fetchFn, cacheDir: null, retries: 1 });

    expect((await http.get(URL_A)).body).toBe("fine");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry other client errors", async () => {
    const fetchFn = vi.fn(async () => failing(404));
    const http = client({ fetch: fetchFn, cacheDir: null, retries: 2 });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("HTTP_STATUS");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget", async () => {
    const fetchFn = vi.fn(async () => failing(503));
    const http = client({ fetch: fetchFn, cacheDir: null, retries: 2 });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("HTTP_STATUS");
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("raises a NETWORK error when the network fails and nothing is cached", async () => {
    const fetchFn = vi.fn(async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    });
    const http = client({ fetch: fetchFn, cacheDir: dir });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("NETWORK");
  });
});

describe("URL policy", () => {
  it.each([
    "https://evil.test/x",
    "http://example.test/a",
    "https://user:pw@example.test/a",
    "https://example.test:8443/a",
    "ftp://example.test/a",
    "not a url",
  ])("refuses %s without making a request", async (url) => {
    const fetchFn = vi.fn(async () => ok("x"));
    const http = client({ fetch: fetchFn, cacheDir: null });

    expect(await errorCodeOfAsync(() => http.get(url))).toBe("BAD_URL");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("follows a redirect to an allowed host", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => ok("moved"));
    fetchFn.mockResolvedValueOnce(redirect("https://example.test/b"));
    const http = client({ fetch: fetchFn, cacheDir: null });

    expect((await http.get(URL_A)).body).toBe("moved");
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://example.test/b");
  });

  it("follows a relative redirect", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => ok("moved"));
    fetchFn.mockResolvedValueOnce(redirect("/elsewhere"));
    const http = client({ fetch: fetchFn, cacheDir: null });

    await http.get(URL_A);
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://example.test/elsewhere");
  });

  it.each(["https://evil.test/x", "http://example.test/b"])("refuses a redirect to %s", async (target) => {
    const fetchFn = vi.fn(async () => redirect(target));
    const http = client({ fetch: fetchFn, cacheDir: null });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("BAD_URL");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    const fetchFn = vi.fn(async () => redirect("https://example.test/loop"));
    const http = client({ fetch: fetchFn, cacheDir: null });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("HTTP_STATUS");
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("sends the configured user agent", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => ok("x"));
    const http = client({ fetch: fetchFn, cacheDir: null, userAgent: "test-agent/1.0" });

    await http.get(URL_A);
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toEqual({ "user-agent": "test-agent/1.0" });
  });
});

describe("size limit", () => {
  it("rejects a body whose declared length is over the limit", async () => {
    const fetchFn = vi.fn(async () => new Response("x", { headers: { "content-length": "999999" } }));
    const http = client({ fetch: fetchFn, cacheDir: null, maxBytes: 100 });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("TOO_LARGE");
  });

  it("rejects a body that streams past the limit", async () => {
    const http = client({ fetch: async () => ok("y".repeat(200)), cacheDir: null, maxBytes: 100 });

    expect(await errorCodeOfAsync(() => http.get(URL_A))).toBe("TOO_LARGE");
  });

  it("does not retry an oversized body", async () => {
    const fetchFn = vi.fn(async () => ok("y".repeat(200)));
    const http = client({ fetch: fetchFn, cacheDir: null, maxBytes: 100, retries: 2 });

    await errorCodeOfAsync(() => http.get(URL_A));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("accepts a body exactly at the limit", async () => {
    const http = client({ fetch: async () => ok("y".repeat(100)), cacheDir: null, maxBytes: 100 });

    expect((await http.get(URL_A)).body).toBe("y".repeat(100));
  });
});
