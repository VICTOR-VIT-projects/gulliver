import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/board", "/brief"];

/** Refreshes the Supabase session on every page request and keeps signed-out visitors out of the app. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Cache-Control headers that stop a CDN from caching a response carrying someone's session.
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        cacheHeaders = headers ?? {};
        for (const [k, v] of Object.entries(cacheHeaders)) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  if (!data?.claims && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(login);
    // Carry over cookie changes (e.g. clearing a dead session) so the browser doesn't keep retrying it.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [k, v] of Object.entries(cacheHeaders)) redirect.headers.set(k, v);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
