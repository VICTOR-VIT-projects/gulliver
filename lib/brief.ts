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
import { Ledger, QlooError, type Evidence } from "./qloo";

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

function settle<T>(work: Promise<T>): Promise<Section<T>> {
  return work.then(
    (data) => ({ status: "ok", data }),
    (err: unknown) => {
      if (!(err instanceof QlooError)) console.error(err);
      return { status: "error", message: err instanceof QlooError ? err.message : "Unexpected error" };
    },
  );
}

const skipped = (reason: string): Section<never> => ({ status: "skipped", reason });

/** Runs every Qloo call for one act. Independent calls go in parallel; the rest wait on the top market and opener. */
export async function gatherBrief(actId: string): Promise<Brief | null> {
  const act = await getAct(actId);
  if (!act) return null;

  const ledger = new Ledger();
  const [markets, openers, sponsors, media, audience] = await Promise.all([
    settle(findMarkets(act, ledger)),
    settle(findOpeners(act, ledger)),
    settle(findSponsors(act, ledger)),
    settle(findMedia(act, ledger)),
    settle(findAudience(act, ledger)),
  ]);

  const top = markets.status === "ok" ? markets.data[0] : undefined;
  const firstOpener = openers.status === "ok" ? openers.data[0] : undefined;

  const [pulse, night, fit] = await Promise.all([
    top
      ? settle(
          cityPulse(act, top, ledger).then((cells) => ({
            metro: top.metro,
            cells: cells.toSorted((a, b) => b.query.affinity - a.query.affinity).slice(0, MAX_HEAT_CELLS),
          })),
        )
      : skipped("No market to zoom into"),
    top
      ? settle(fanNight(act, top.venue, ledger).then((spots) => ({ venue: top.venue.name, spots })))
      : skipped("No venue to plan around"),
    firstOpener
      ? settle(openerFit(act, firstOpener, ledger).then((f) => ({ openerId: firstOpener.id, ...f })))
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
