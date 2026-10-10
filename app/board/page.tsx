import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, currentUser } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { deleteAccount } from "./actions";

export const metadata: Metadata = { title: "Tour board" };

function LoadError({ what }: { what: string }) {
  return (
    <p role="alert" className="mt-3 border-l-2 border-signal pl-4 text-signal-ink">
      Couldn&apos;t load your {what}.{" "}
      <Link href="/board" className="underline underline-offset-4">
        Try again
      </Link>
    </p>
  );
}

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/board");
  const params = await searchParams;

  const supabase = await createClient();
  const [roster, briefs] = await Promise.all([
    supabase.from("roster").select("act_id, name, kind").order("added_at", { ascending: false }),
    supabase.from("briefs").select("id, number, act_name, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (roster.error) console.error(`[board] roster read failed: ${roster.error.message}`);
  if (briefs.error) console.error(`[board] briefs read failed: ${briefs.error.message}`);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="kicker">{user.isGuest ? "Guest board" : user.email}</p>
          <h1 className="poster text-6xl">Tour board</h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn btn-plain">
            Sign out
          </button>
        </form>
      </header>

      {params.error === "delete" && (
        <p role="alert" className="mt-6 border-l-2 border-signal pl-4 text-signal-ink">
          Your account wasn&apos;t deleted. Nothing was removed. Try again, or sign out and back in first.
        </p>
      )}

      <section className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="kicker">Roster</h2>
          {roster.error ? (
            <LoadError what="roster" />
          ) : roster.data.length ? (
            <ul className="mt-3 divide-y divide-rule">
              {roster.data.map((a) => (
                <li key={a.act_id} className="py-2">
                  {a.name} <span className="kicker">{a.kind}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-soft">No acts yet. Search for an artist or comedian to start a brief.</p>
          )}
        </div>
        <div>
          <h2 className="kicker">Saved briefs</h2>
          {briefs.error ? (
            <LoadError what="saved briefs" />
          ) : briefs.data.length ? (
            <ul className="mt-3 divide-y divide-rule">
              {briefs.data.map((b) => (
                <li key={b.id} className="flex justify-between py-2">
                  <span>{b.act_name}</span>
                  <span className="font-mono text-sm text-muted">No. {String(b.number).padStart(3, "0")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-soft">Briefs you save show up here, numbered like tickets.</p>
          )}
        </div>
      </section>

      <footer className="mt-16 border-t border-rule pt-6">
        <details className="text-sm" open={params.error === "delete"}>
          <summary className="cursor-pointer text-signal-ink underline underline-offset-4">Delete my account</summary>
          <div className="mt-3 max-w-md space-y-3 text-ink-soft">
            <p>This removes your roster, every saved brief and any share links. It can&apos;t be undone.</p>
            <form action={deleteAccount}>
              <button type="submit" className="btn btn-signal">
                Delete everything
              </button>
            </form>
          </div>
        </details>
      </footer>
    </main>
  );
}
