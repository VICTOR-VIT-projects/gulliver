import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, safeNext } from "@/lib/supabase/server";
import { continueAsGuest, signInWithGitHub } from "./actions";
import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  github: "GitHub sign-in didn't go through. Try again.",
  guest: "Couldn't start a guest session. Try again in a minute.",
  link: "That sign-in link has expired, or was opened in a different browser. Send yourself a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUser()) redirect(next);
  const error = params.error ? ERRORS[params.error] : undefined;

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
      <section aria-labelledby="brand" className="space-y-6">
        <Link href="/" className="kicker hover:text-ink">
          ← Gulliver
        </Link>
        <h1 id="brand" className="poster text-[clamp(4rem,13vw,9.5rem)]">
          Every city,
          <br />
          <span className="text-signal">sized up.</span>
        </h1>
        <p className="max-w-md text-lg text-ink-soft">
          Where an act&apos;s audience over-indexes, who fits the support slot, which brands share the crowd. One brief
          per act, built on Qloo&apos;s taste graph.
        </p>
      </section>

      <section aria-labelledby="signin" className="stub p-6 sm:p-8">
        <p className="kicker">Admit one</p>
        <h2 id="signin" className="poster mt-2 text-4xl">
          Sign in to your tour board
        </h2>
        <p className="mt-2 text-ink-soft">Save briefs, keep a roster of acts, share a brief with your team.</p>

        {error && (
          <p role="alert" className="mt-5 border-l-2 border-signal pl-4 text-signal-ink">
            {error}
          </p>
        )}

        <form action={signInWithGitHub} className="mt-6">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="btn btn-ink w-full">
            <GitHubMark />
            Continue with GitHub
          </button>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-rule" />
          <span className="kicker">or</span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        <MagicLinkForm next={next} />

        <div className="mt-8 border-t border-dashed border-ink pt-6">
          <form action={continueAsGuest}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn btn-signal w-full">
              Look around as a guest
            </button>
          </form>
          <p className="mt-3 text-sm text-muted">No account needed. A guest board lives in this browser only.</p>
        </div>
      </section>

      <p className="text-sm text-muted lg:col-span-2">
        We store your email or GitHub ID, the acts on your roster and the briefs you save, nothing else. You can delete
        all of it from your board. Results are aggregate taste affinities from Qloo, not data about any individual.
      </p>
    </main>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
