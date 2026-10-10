"use client";

import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "./actions";

export function MagicLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <p role="status" className="border-l-2 border-signal pl-4 text-ink-soft">
        Check <span className="font-mono text-ink">{state.message}</span>. The link signs you in on this browser and
        expires in an hour.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="kicker block">
        Email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@yourvenue.com"
          className="field"
          aria-describedby={state.status === "error" ? "email-error" : undefined}
        />
        <button type="submit" disabled={pending} className="btn btn-plain shrink-0">
          {pending ? "Sending" : "Send link"}
        </button>
      </div>
      {state.status === "error" && (
        <p id="email-error" role="alert" className="text-sm text-signal-ink">
          {state.message}
        </p>
      )}
    </form>
  );
}
