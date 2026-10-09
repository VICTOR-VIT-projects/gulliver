import "server-only";

const BASE_URL = "https://hackathon.api.qloo.com";
const ONE_DAY = 60 * 60 * 24;
const TIMEOUT_MS = 15_000;
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

/** One Qloo request, recorded so the brief can show exactly where each number came from. */
export interface Evidence {
  id: string;
  label: string;
  path: string;
  params: Record<string, string>;
  status: number;
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
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
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

// ponytail: per-instance throttle; concurrent serverless instances can still exceed 5/s together.
// The retry below absorbs that; move to a shared limiter (e.g. Upstash) if 429s show up in logs.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function send(url: string, apiKey: string): Promise<Response> {
  await throttle();
  return fetch(url, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: ONE_DAY },
  });
}

/**
 * GET a Qloo endpoint. Responses are cached server-side for a day (allowed by the hackathon rules;
 * nothing is persisted to the repo). Retries once on rate limits and gateway errors, after the
 * per-second window resets. Qloo's "System Error" 500s are deterministic for a given query, so
 * those are not retried.
 */
export async function qloo<T>(
  path: string,
  params: Params,
  meta: { label: string; ledger?: Ledger },
): Promise<{ results: T; evidenceId?: string }> {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) throw new QlooError(500, "QLOO_API_KEY is not configured");

  const query = clean(params);
  const url = `${BASE_URL}${path}?${new URLSearchParams(query)}`;
  const started = Date.now();

  let res = await send(url, apiKey);
  if (RETRYABLE.has(res.status)) {
    await new Promise((r) => setTimeout(r, 1_100));
    res = await send(url, apiKey);
  }

  const body = (await res.json().catch(() => null)) as { results?: T; errors?: { message: string }[] } | null;
  const results = (body?.results ?? (Array.isArray(body) ? body : undefined)) as T | undefined;

  const evidenceId = meta.ledger?.record({
    label: meta.label,
    path,
    params: query,
    status: res.status,
    rows: countRows(results),
    ms: Date.now() - started,
  });

  if (!res.ok || results === undefined) {
    const message = body?.errors?.map((e) => e.message).join("; ") || `Qloo ${path} returned ${res.status}`;
    throw new QlooError(res.status, message);
  }
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
