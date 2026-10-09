// Health check: hit every Qloo call Gulliver depends on, print shape + emptiness.
// Run: node --env-file=.env scripts/spike.ts ["Artist name"] ["Comedian name"]
// Prints summaries only — never commit raw Qloo responses (hackathon rules).
// Day-1 findings (Oct 9): national heatmap → 500, /v2/trending → always empty,
// audience_growth → always 0. Those calls are deliberately not used.

export {}; // makes this an ES module so top-level await type-checks

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) throw new Error("QLOO_API_KEY missing — put it in .env");

const [artistName = "Khruangbin", comedianName = "John Mulaney"] = process.argv.slice(2);
const VENUE_TAGS = "urn:tag:setting:qloo:music_venue,urn:tag:category:place:concert_hall,urn:tag:category:place:amphitheater";
const COMEDY_TAGS = "urn:tag:category:place:comedy_club";
const NIGHT_TAGS = "urn:tag:category:place:bar,urn:tag:category:place:restaurant";

let failures = 0;

async function check(label: string, path: string, params: Record<string, string>) {
  const t = Date.now();
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": KEY! } });
  const body: any = await res.json().catch(() => ({}));
  const r = body?.results ?? {};
  const key = Array.isArray(r) ? null : Object.keys(r).find((k) => Array.isArray(r[k]) && r[k].length);
  const arr = Array.isArray(r) ? r : key ? r[key] : [];
  const ok = res.status === 200 && arr.length > 0;
  if (!ok) failures++;
  const first = arr[0]?.name ?? arr[0]?.location?.geohash ?? (arr[0] ? "row" : "-");
  console.log(`${ok ? "OK  " : "FAIL"} ${res.status} ${String(Date.now() - t).padStart(4)}ms  ${label}: ${arr.length} rows, first="${first}"`);
  if (res.status !== 200) console.log(`     ${JSON.stringify(body).slice(0, 200)}`);
  return arr;
}

const [artist] = await check(`search "${artistName}"`, "/search", { query: artistName, types: "urn:entity:artist", take: "1" });
const [comic] = await check(`search "${comedianName}"`, "/search", { query: comedianName, types: "urn:entity:person", take: "1" });
if (!artist) throw new Error("artist not resolved — nothing else will work");
const sig = { "signal.interests.entities": artist.entity_id };

const venues = await check("markets: venues nationwide, 1 per city", "/v2/insights", { "filter.type": "urn:entity:place", "filter.tags": VENUE_TAGS, ...sig, "filter.location.query": "United States", "diversify.by": "properties.geocode.city", "diversify.take": "1", take: "25" });
const topCity = venues[0]?.properties?.geocode?.city ?? "Chicago";
await check(`zoom: heatmap ${topCity}`, "/v2/insights", { "filter.type": "urn:heatmap", ...sig, "filter.location.query": topCity });
const openers = await check("openers", "/v2/insights", { "filter.type": "urn:entity:artist", ...sig, "bias.trends": "high", "feature.explainability": "true", take: "10" });
if (openers[0]) await check("opener fit (compare)", "/v2/analysis/compare", { "a.signal.interests.entities": artist.entity_id, "b.signal.interests.entities": openers[0].entity_id, take: "10" });
await check("sponsors", "/v2/insights", { "filter.type": "urn:entity:brand", ...sig, "feature.explainability": "true", take: "10" });
await check("media: podcasts", "/v2/insights", { "filter.type": "urn:entity:podcast", ...sig, take: "5" });
await check("media: tv", "/v2/insights", { "filter.type": "urn:entity:tv_show", ...sig, take: "5" });
await check("audience", "/v2/insights", { "filter.type": "urn:demographics", ...sig });
const v = venues[0]?.location;
if (v) await check("fan night near top venue", "/v2/insights", { "filter.type": "urn:entity:place", "filter.tags": NIGHT_TAGS, ...sig, "filter.location": `POINT(${v.lon} ${v.lat})`, "filter.location.radius": "2000", take: "6" });
if (comic) await check("comedy venues", "/v2/insights", { "filter.type": "urn:entity:place", "filter.tags": COMEDY_TAGS, "signal.interests.entities": comic.entity_id, "filter.location.query": "United States", "diversify.by": "properties.geocode.city", "diversify.take": "1", take: "10" });

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exitCode = failures ? 1 : 0;
