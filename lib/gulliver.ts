import "server-only";
import { imageOf, num, qloo, str, type HeatCell, type Ledger, type QlooEntity } from "./qloo";

export type ActKind = "artist" | "comedian";

export interface Act {
  id: string;
  name: string;
  kind: ActKind;
  image?: string;
  popularity?: number;
  tags: string[];
}

export interface Market {
  city: string;
  metro: string;
  region?: string;
  affinity: number;
  venue: { id: string; name: string; address?: string; neighborhood?: string; lat: number; lon: number; image?: string };
}

export interface Opener {
  id: string;
  name: string;
  image?: string;
  affinity: number;
  popularity?: number;
  tags: string[];
}

export interface OpenerFit {
  shared: string[];
  headlinerOnly: string[];
  openerOnly: string[];
}

export interface Sponsor {
  id: string;
  name: string;
  image?: string;
  affinity: number;
  industries?: string;
  description?: string;
  priceRange?: [number, number];
  partnerships?: string;
}

export interface MediaPick {
  id: string;
  name: string;
  image?: string;
  affinity: number;
  description?: string;
}

export interface Spot {
  id: string;
  name: string;
  image?: string;
  affinity: number;
  address?: string;
  priceLevel?: number;
  rating?: number;
  lat: number;
  lon: number;
}

export const AGE_BANDS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export interface Audience {
  age: Record<AgeBand, number>;
  gender: { male: number; female: number };
}

const TAGS = {
  musicVenue: "urn:tag:setting:qloo:music_venue,urn:tag:category:place:concert_hall,urn:tag:category:place:amphitheater",
  comedyVenue: "urn:tag:category:place:comedy_club",
  comedian: "urn:tag:genre:person:comedian",
  nightOut: "urn:tag:category:place:bar,urn:tag:category:place:restaurant",
};

const affinityOf = (e: QlooEntity) => e.query?.affinity ?? 0;
const tagNames = (e: QlooEntity, n = 6) => (e.tags ?? []).slice(0, n).map((t) => t.name);
const isComedian = (e: QlooEntity) => (e.tags ?? []).some((t) => /:comedian$/.test(t.id ?? t.tag_id ?? ""));

function toAct(e: QlooEntity, kind: ActKind): Act {
  return { id: e.entity_id, name: e.name, kind, image: imageOf(e), popularity: e.popularity, tags: tagNames(e) };
}

/** Autocomplete: musicians and comedians. Other people (athletes, actors) are filtered out. */
export async function searchActs(query: string): Promise<Act[]> {
  const [artists, people] = await Promise.all([
    qloo<QlooEntity[]>("/search", { query, types: "urn:entity:artist", take: 5 }, { label: "Search artists" }),
    qloo<QlooEntity[]>("/search", { query, types: "urn:entity:person", take: 10 }, { label: "Search comedians" }),
  ]);
  return [
    ...artists.results.map((e) => toAct(e, "artist")),
    ...people.results.filter(isComedian).slice(0, 3).map((e) => toAct(e, "comedian")),
  ];
}

export async function getAct(id: string): Promise<Act | null> {
  const { results } = await qloo<QlooEntity[]>("/entities", { entity_ids: id }, { label: "Look up act" });
  const e = results[0];
  if (!e) return null;
  return toAct(e, isComedian(e) ? "comedian" : "artist");
}

/**
 * One query across the US, capped at one venue per metro, so affinities are comparable between
 * markets. Diversifying by city instead lets one metro's suburbs crowd the list.
 */
export async function findMarkets(act: Act, ledger: Ledger, take = 20): Promise<Market[]> {
  const { results } = await qloo<{ entities: QlooEntity[] }>(
    "/v2/insights",
    {
      "filter.type": "urn:entity:place",
      "filter.tags": act.kind === "comedian" ? TAGS.comedyVenue : TAGS.musicVenue,
      "signal.interests.entities": act.id,
      "filter.location.query": "United States",
      "diversify.by": "properties.geocode.metro",
      "diversify.take": 1,
      take,
    },
    { label: "Best-fit venue in each US metro", ledger },
  );
  return results.entities.flatMap((e) => {
    const geo = (e.properties?.geocode ?? {}) as Record<string, unknown>;
    const city = str(geo.city);
    if (!city || !e.location) return [];
    return [
      {
        city,
        metro: str(geo.metro) ?? city,
        region: str(geo.admin1_region),
        affinity: affinityOf(e),
        venue: {
          id: e.entity_id,
          name: e.name,
          address: str(e.properties?.address),
          neighborhood: str(e.properties?.neighborhood),
          lat: e.location.lat,
          lon: e.location.lon,
          image: imageOf(e),
        },
      },
    ];
  });
}

/**
 * Neighbourhood-level affinity (geohash cells) within 40 km of a venue. Querying by point rather
 * than by city name keeps suburban venues from collapsing to a handful of cells.
 */
export async function cityPulse(act: Act, market: Market, ledger: Ledger): Promise<HeatCell[]> {
  const { results } = await qloo<{ heatmap: HeatCell[] }>(
    "/v2/insights",
    {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": act.id,
      "filter.location": `POINT(${market.venue.lon} ${market.venue.lat})`,
      "filter.location.radius": 40_000,
    },
    { label: `Affinity heatmap around ${market.metro}`, ledger },
  );
  return results.heatmap;
}

export async function findOpeners(act: Act, ledger: Ledger, take = 8): Promise<Opener[]> {
  const { results } = await qloo<{ entities: QlooEntity[] }>(
    "/v2/insights",
    act.kind === "comedian"
      ? { "filter.type": "urn:entity:person", "filter.tags": TAGS.comedian, "signal.interests.entities": act.id, take }
      : { "filter.type": "urn:entity:artist", "signal.interests.entities": act.id, "bias.trends": "high", take },
    { label: act.kind === "comedian" ? "Comedians with a shared audience" : "Artists with a shared audience", ledger },
  );
  return results.entities
    .filter((e) => e.entity_id !== act.id)
    .map((e) => ({ id: e.entity_id, name: e.name, image: imageOf(e), affinity: affinityOf(e), popularity: e.popularity, tags: tagNames(e, 4) }));
}

/** What the two crowds share, and what each one brings on its own. */
export async function openerFit(act: Act, opener: { id: string; name: string }, ledger: Ledger): Promise<OpenerFit> {
  type Row = { name: string; query?: { score?: number } };
  const { results } = await qloo<{ tags?: Row[]; a?: Row[]; b?: Row[] }>(
    "/v2/analysis/compare",
    { "a.signal.interests.entities": act.id, "b.signal.interests.entities": opener.id, take: 10 },
    { label: `Audience overlap, ${act.name} × ${opener.name}`, ledger },
  );
  const names = (rows: Row[] = [], n: number) => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.name.toLowerCase())) seen.set(r.name.toLowerCase(), r.name);
    return [...seen.values()].slice(0, n);
  };
  return { shared: names(results.tags, 5), headlinerOnly: names(results.a, 3), openerOnly: names(results.b, 3) };
}

export async function findSponsors(act: Act, ledger: Ledger, take = 8): Promise<Sponsor[]> {
  const { results } = await qloo<{ entities: QlooEntity[] }>(
    "/v2/insights",
    { "filter.type": "urn:entity:brand", "signal.interests.entities": act.id, take },
    { label: "Brands the audience over-indexes on", ledger },
  );
  return results.entities.map((e) => {
    const p = e.properties ?? {};
    const lo = num(p.price_range_usd_min);
    const hi = num(p.price_range_usd_max);
    return {
      id: e.entity_id,
      name: e.name,
      image: imageOf(e),
      affinity: affinityOf(e),
      industries: str(p.industries),
      description: str(p.short_description),
      priceRange: lo !== undefined && hi !== undefined ? [lo, hi] : undefined,
      partnerships: str(p.known_partnerships),
    };
  });
}

export async function findMedia(act: Act, ledger: Ledger): Promise<{ podcasts: MediaPick[]; shows: MediaPick[] }> {
  const pick = async (type: string, label: string) => {
    const { results } = await qloo<{ entities: QlooEntity[] }>(
      "/v2/insights",
      { "filter.type": type, "signal.interests.entities": act.id, take: 5 },
      { label, ledger },
    );
    return results.entities.map((e) => ({
      id: e.entity_id,
      name: e.name,
      image: imageOf(e),
      affinity: affinityOf(e),
      description: str(e.properties?.short_description) ?? str(e.properties?.description),
    }));
  };
  const [podcasts, shows] = await Promise.all([
    pick("urn:entity:podcast", "Podcasts the audience over-indexes on"),
    pick("urn:entity:tv_show", "TV the audience over-indexes on"),
  ]);
  return { podcasts, shows };
}

/** Skew scores in [-1, 1] relative to the general population, not shares of the audience. */
export async function findAudience(act: Act, ledger: Ledger): Promise<Audience | null> {
  const { results } = await qloo<{ demographics: { query: Partial<Audience> }[] }>(
    "/v2/insights",
    { "filter.type": "urn:demographics", "signal.interests.entities": act.id },
    { label: "Audience age and gender skew", ledger },
  );
  const q = results.demographics[0]?.query;
  if (!q?.age || !q.gender) return null;
  return { age: q.age, gender: q.gender };
}

/** Pre- and post-show spots near a venue. Chains and private clubs are filtered out by price and popularity. */
export async function fanNight(act: Act, at: { lat: number; lon: number }, ledger: Ledger): Promise<Spot[]> {
  const base = {
    "filter.type": "urn:entity:place",
    "filter.tags": TAGS.nightOut,
    "signal.interests.entities": act.id,
    "filter.location": `POINT(${at.lon} ${at.lat})`,
    "filter.location.radius": 2000,
    take: 6,
  };
  let { results } = await qloo<{ entities: QlooEntity[] }>(
    "/v2/insights",
    { ...base, "filter.price_level.min": 2, "filter.popularity.min": 0.5 },
    { label: "Bars and restaurants near the venue", ledger },
  );
  if (results.entities.length < 3) {
    ({ results } = await qloo<{ entities: QlooEntity[] }>(
      "/v2/insights",
      { ...base, "filter.location.radius": 6000, "filter.price_level.min": 2 },
      { label: "Bars and restaurants within 6 km of the venue", ledger },
    ));
  }
  return results.entities.flatMap((e) =>
    e.location
      ? [
          {
            id: e.entity_id,
            name: e.name,
            image: imageOf(e),
            affinity: affinityOf(e),
            address: str(e.properties?.address),
            priceLevel: num(e.properties?.price_level),
            rating: num(e.properties?.business_rating),
            lat: e.location.lat,
            lon: e.location.lon,
          },
        ]
      : [],
  );
}
