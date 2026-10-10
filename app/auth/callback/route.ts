import { NextResponse } from "next/server";
import { createClient, safeNext } from "@/lib/supabase/server";

/** Landing point for GitHub OAuth and email magic links: trade the one-time code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn(`[auth] code exchange failed: ${error.message}`);
  }
  return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
