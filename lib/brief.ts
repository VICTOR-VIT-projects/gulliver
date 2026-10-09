import "server-only";
import {
  cityPulse,
  fanNight,
  findAudience,
  findMarkets,
  findMedia,
  findOpeners,
  findSponsors,
  getAct,
  openerFit,
  type Act,
} from "./gulliver";
import { Ledger, QlooError, type Evidence, type FailureKind } from "./qloo";

export type Section<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }
  | { status: "skipped"; reason: string };

type Data<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;

export interface Brief {
  act: Act;
  generatedAt: string;
  markets: Section<Data<typeof findMarkets>>;
  pulse: Section<{ metro: string; cells: Data<typeof cityPulse> }>;
  openers: Section<Data<typeof findOpeners>>;
  openerFit: Section<{ openerId: string } & Data<typeof openerFit>>;
  sponsors: Section<Data<typeof findSponsors>>;
  media: Section<Data<typeof findMedia>>;
  audience: Section<Data<typeof findAudience>>;
  fanNight: Section<{ venue: string; spots: Data<typeof fanNight> }>;
  evidence: Evidence[];
}

// ponytail: heatmap trimmed to the strongest cells; send all if the map needs full coverage
const MAX_HEAT_CELLS = 400;

// Leaves headroom under the route's 60 s maxDuration to serialize the response.
const BRIEF_DEADLINE_MS = 45_000;

const SECTION_FAILED: Record<FailureKind, string> = {
  http: "Qloo couldn't answer this one.",
  timeout: "Qloo took too long on this one.",
  network: "Couldn't reach Qloo for this one.",
  deadline: "Ran out of time on this one.",
  config: "This section isn't available right now.",
};

/** Upstream detail is logged server-side only; the client gets a fixed message. */
function settle<T>(work: Promise<T>): Promise<Section<T>> {
  return work.then(
    (data) => ({ status: "ok", data }),
    (err: unknown) => {
      if (err instanceof QlooError) {
        console.warn(`[brief] section failed: ${err.kind} ${err.status ?? "-"} ${err.message}`);
        return { status: "error", message: SECTION_FAILED[err.kind] };
      }
      console.error(err);
      return { status: "error", message: SECTION_FAILED.config };
    },
  );
}

const skipped = (reason: string): Section<never> => ({ status: "skipped", reason });

/** Runs every Qloo call for one act. Independent calls go in parallel; the rest wait on the top market and opener. */
export async function gatherBrief(actId: string): Promise<Brief | null> {
  const ledger = new Ledger();
  const run = { ledger, deadline: AbortSignal.timeout(BRIEF_DEADLINE_MS) };
  const act = await getAct(actId, run);
  if (!act) return null;

  const [markets, openers, sponsors, media, audience] = await Promise.all([
    settle(findMarkets(act, run)),
    settle(findOpeners(act, run)),
    settle(findSponsors(act, run)),
    settle(findMedia(act, run)),
    settle(findAudience(act, run)),
  ]);

  const top = markets.status === "ok" ? markets.data[0] : undefined;
  const firstOpener = openers.status === "ok" ? openers.data[0] : undefined;

  const [pulse, night, fit] = await Promise.all([
    top
      ? settle(
          cityPulse(act, top, run).then((cells) => ({
            metro: top.metro,
            cells: cells.toSorted((a, b) => b.query.affinity - a.query.affinity).slice(0, MAX_HEAT_CELLS),
          })),
        )
      : skipped("No market to zoom into"),
    top
      ? settle(fanNight(act, top.venue, run).then((spots) => ({ venue: top.venue.name, spots })))
      : skipped("No venue to plan around"),
    firstOpener
      ? settle(openerFit(act, firstOpener, run).then((f) => ({ openerId: firstOpener.id, ...f })))
      : skipped("No opener to compare"),
  ]);

  return {
    act,
    generatedAt: new Date().toISOString(),
    markets,
    pulse,
    openers,
    openerFit: fit,
    sponsors,
    media,
    audience,
    fanNight: night,
    evidence: ledger.entries,
  };
}
