import Link from "next/link";
import { currentUser } from "@/lib/supabase/server";
import { continueAsGuest } from "./login/actions";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-8 px-4 py-12 sm:px-8">
      <p className="kicker">Gulliver · tour intelligence</p>
      <h1 className="poster text-[clamp(4.5rem,15vw,11rem)]">
        Every city,
        <br />
        <span className="text-signal">sized up.</span>
      </h1>
      <p className="max-w-xl text-lg text-ink-soft">
        For promoters, venues and talent agents: the markets, support acts and brands that share an act&apos;s
        audience taste, from aggregate affinity data in Qloo&apos;s taste graph. It doesn&apos;t forecast ticket sales
        or describe any individual fan.
      </p>

      {params.deleted && (
        <p role="status" className="max-w-xl border-l-2 border-signal pl-4 text-ink-soft">
          Your account and everything on your board have been deleted.
        </p>
      )}

      {user ? (
        <div>
          <Link href="/board" className="btn btn-signal">
            Open your tour board
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <form action={continueAsGuest}>
            <input type="hidden" name="next" value="/board" />
            <button type="submit" className="btn btn-signal">
              Explore as guest
            </button>
          </form>
          <Link href="/login" className="btn btn-plain">
            Sign in
          </Link>
          <p className="w-full text-sm text-muted">No account needed to look around.</p>
        </div>
      )}
    </main>
  );
}
