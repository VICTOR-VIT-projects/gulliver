"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, safeNext } from "@/lib/supabase/server";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return h.get("origin") ?? `${proto}://${host}`;
}

const callback = async (next: string) => `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signInWithGitHub(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: await callback(safeNext(formData.get("next"))) },
  });
  if (error || !data.url) redirect("/login?error=github");
  redirect(data.url);
}

export async function continueAsGuest(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) redirect(`/login?error=guest&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export type MagicLinkState = { status: "idle" | "sent" | "error"; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { status: "error", message: "That doesn't look like an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callback(safeNext(formData.get("next"))) },
  });
  if (error) {
    console.warn(`[auth] magic link failed: ${error.message}`);
    const limited = error.status === 429;
    return { status: "error", message: limited ? "Too many links sent. Try again in a few minutes." : "Couldn't send the link. Try again." };
  }
  return { status: "sent", message: email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
