import "server-only";
import { unstable_cache } from "next/cache";

const BASE_URL = "https://hackathon.api.qloo.com";
const ONE_DAY = 60 * 60 * 24;
const ATTEMPT_TIMEOUT_MS = 8_000;
const RETRY_AFTER_MS = 1_100;
const RETRYABLE = new Set([429, 502, 503, 504]);
// Hackathon keys allow 5 requests/second (x-second-ratelimit-limit) and 10k/month.
const MIN_GAP_MS = 220;

export type Params = Record<string, string | number | undefined>;

export interface QlooTag {
  id?: string;
  tag_id?: string;
  name: string;
  type?: string;
}

export interface QlooEntity {
  entity_id: string;
  name: string;
  types?: string[];
  subtype?: string;
  popularity?: number;
  location?: { lat: number; lon: number };
  tags?: QlooTag[];
  properties?: Record<string, unknown>;
  query?: { affinity?: number };
}

export interface HeatCell {
  location: { latitude: number; longitude: number; geohash: string };
  query: { affinity: number; affinity_rank: number; popularity: number };
}

export type FailureKind = "http" | "timeout" | "network" | "deadline" | "config";

/** One Qloo call as the user sees it in the evidence drawer. */
export interface Evidence {
  id: string;
  label: string;
  path: string;
  params: Record<string, string>;
  /** HTTP status of the final attempt; null when no response arrived. */
  status: number | null;
  failure?: FailureKind;
  attempts: number;
  cached: boolean;
  rows: number;
  ms: number;
}

export class Ledger {
  readonly entries: Evidence[] = [];

  record(entry: Omit<Evidence, "id">): string {
    const id = `E${this.entries.length + 1}`;
    this.entries.push({ id, ...entry });
    return id;
  }
}

export class QlooError extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly status: number | null,
    message: string,
    readonly attempts = 0,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

interface Fetched {
  status: number;
  results: unknown;
  attempts: number;
  fetchedAt: number;
}

// ponytail: per-instance throttle; concurrent serverless instances can still exceed 5/s together.
// The retry absorbs that, and cache hits never reach it. Move to a shared limiter if 429s show up in logs.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function attempt(url: string, apiKey: string): Promise<Response> {
  await throttle();
  try {
    return await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    throw new QlooError(timedOut ? "timeout" : "network", null, timedOut ? "Qloo timed out" : "Qloo unreachable", 1);
  }
}

/**
 * Network path, shared across instances through Next's data cache. Only successful responses are
 * cached: failures throw, and unstable_cache doesn't store rejections. Qloo's "System Error" 500s
 * are deterministic for a given query, so only rate limits and gateway errors are retried.
 */
const fetchQloo = unstable_cache(
  async (url: string): Promise<Fetched> => {
    const apiKey = process.env.QLOO_API_KEY;
    if (!apiKey) throw new QlooError("config", null, "QLOO_API_KEY is not configured");

    let attempts = 1;
    let res = await attempt(url, apiKey);
    if (RETRYABLE.has(res.status)) {
      await new Promise((r) => setTimeout(r, RETRY_AFTER_MS));
      attempts++;
      res = await attempt(url, apiKey).catch((err: QlooError) => {
        throw new QlooError(err.kind, null, err.message, attempts);
      });
    }

    const body = (await res.json().catch(() => null)) as { results?: unknown; errors?: { message?: string }[] } | unknown[] | null;
    if (!res.ok) {
      const errors = Array.isArray(body) ? undefined : body?.errors;
      const detail = errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
      throw new QlooError("http", res.status, detail, attempts);
    }
    // /search returns a bare array; everything else wraps rows in `results`. Validate here so a
    // malformed 200 is never cached.
    const results = Array.isArray(body) ? body : body?.results;
    if (results === undefined || results === null) {
      throw new QlooError("http", res.status, "Response had no results", attempts);
    }
    return { status: res.status, results, attempts, fetchedAt: Date.now() };
  },
  ["qloo-v2"],
  { revalidate: ONE_DAY },
);

/** Starts `start()` only if the deadline hasn't passed, then rejects early if it passes mid-flight. */
function beforeDeadline<T>(start: () => Promise<T>, deadline?: AbortSignal): Promise<T> {
  if (!deadline) return start();
  if (deadline.aborted) return Promise.reject(new QlooError("deadline", null, "Brief deadline reached"));
  const work = start();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new QlooError("deadline", null, "Brief deadline reached"));
    deadline.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => deadline.removeEventListener("abort", onAbort));
  });
}

function clean(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out[k] = String(v);
  return out;
}

function countRows(results: unknown): number {
  if (Array.isArray(results)) return results.length;
  if (results && typeof results === "object") {
    for (const v of Object.values(results)) if (Array.isArray(v)) return v.length;
  }
  return 0;
}

export interface CallContext {
  label: string;
  ledger?: Ledger;
  deadline?: AbortSignal;
}

/** GET a Qloo endpoint and record the call (success or failure) in the brief's ledger. */
export async function qloo<T>(path: string, params: Params, ctx: CallContext): Promise<{ results: T; evidenceId?: string }> {
  const query = clean(params);
  const url = `${BASE_URL}${path}?${new URLSearchParams(query)}`;
  const started = Date.now();
  const record = (e: Pick<Evidence, "status" | "failure" | "attempts" | "cached" | "rows">) =>
    ctx.ledger?.record({ label: ctx.label, path, params: query, ms: Date.now() - started, ...e });

  let fetched: Fetched;
  try {
    fetched = await beforeDeadline(() => fetchQloo(url), ctx.deadline);
  } catch (err) {
    const e = err instanceof QlooError ? err : new QlooError("network", null, "Unexpected failure");
    record({ status: e.status, failure: e.kind, attempts: e.attempts, cached: false, rows: 0 });
    throw e;
  }

  const results = fetched.results as T;
  // A miss always includes a network round trip, so it finishes strictly after `started`.
  const cached = fetched.fetchedAt <= started;
  const evidenceId = record({ status: fetched.status, attempts: fetched.attempts, cached, rows: countRows(results) });
  return { results, evidenceId };
}

export function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(", ") || undefined;
  return undefined;
}

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function imageOf(entity: QlooEntity): string | undefined {
  const image = entity.properties?.image as { url?: unknown } | undefined;
  return typeof image?.url === "string" ? image.url : undefined;
}
