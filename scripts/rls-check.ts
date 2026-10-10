// Proves the database rules hold: two guest users try to read and change each other's data.
// Run after applying supabase/migrations: node --env-file=.env scripts/rls-check.ts
// Creates two anonymous users and deletes them (and their rows) at the end.
export {};

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env");

const ACT = "BAF6317A-DF94-4C90-92AE-63F86560C21B";
let failures = 0;

function expect(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: {
      apikey: KEY!,
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function guest() {
  const { status, body } = await call("/auth/v1/signup", { method: "POST", body: JSON.stringify({}) });
  if (status !== 200 || !body?.access_token) throw new Error(`anonymous sign-in failed: ${status} ${JSON.stringify(body).slice(0, 200)}`);
  return { token: body.access_token as string, id: body.user.id as string };
}

const a = await guest();
const b = await guest();
console.log(`guests created: A=${a.id.slice(0, 8)}… B=${b.id.slice(0, 8)}…\n`);
const slug = crypto.randomUUID().replaceAll("-", "").slice(0, 24);

try {
  const rep = { Prefer: "return=representation" };

  let r = await call("/rest/v1/roster", { method: "POST", token: a.token, headers: rep, body: JSON.stringify({ act_id: ACT, name: "Khruangbin", kind: "artist" }) });
  expect("A adds an act to their roster", r.status === 201, `${r.status}`);

  r = await call("/rest/v1/briefs", { method: "POST", token: a.token, headers: rep, body: JSON.stringify({ act_id: ACT, act_name: "Khruangbin", payload: { test: true }, number: 999 }) });
  const briefId = r.body?.[0]?.id;
  expect("A saves a brief; number is assigned, not client-chosen", r.status === 201 && r.body?.[0]?.number === 1, `${r.status} number=${r.body?.[0]?.number}`);
  r = await call("/rest/v1/briefs", { method: "POST", token: a.token, headers: rep, body: JSON.stringify({ act_id: ACT, act_name: "Khruangbin", payload: { test: 2 } }) });
  expect("A's second brief is No. 2", r.body?.[0]?.number === 2, `number=${r.body?.[0]?.number}`);

  // 12 at once reliably reproduced duplicate numbers before migration 20261010140000.
  const burst = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      call("/rest/v1/briefs", { method: "POST", token: a.token, headers: rep, body: JSON.stringify({ act_id: ACT, act_name: "Khruangbin", payload: { burst: i } }) }),
    ),
  );
  const numbers = burst.map((x) => x.body?.[0]?.number).sort((p, q) => p - q);
  expect(
    "12 simultaneous saves all succeed with distinct numbers",
    burst.every((x) => x.status === 201) && numbers.join() === Array.from({ length: 12 }, (_, i) => i + 3).join(),
    `statuses=${burst.map((x) => x.status)} numbers=${numbers}`,
  );

  r = await call("/rest/v1/roster?select=*", { token: b.token });
  expect("B cannot see A's roster", r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `${r.status} rows=${r.body?.length}`);
  r = await call("/rest/v1/briefs?select=*", { token: b.token });
  expect("B cannot see A's briefs", r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `${r.status} rows=${r.body?.length}`);

  r = await call("/rest/v1/roster", { method: "POST", token: b.token, body: JSON.stringify({ user_id: a.id, act_id: ACT, name: "x", kind: "artist" }) });
  expect("B cannot write into A's roster", r.status === 403 || r.status === 401, `${r.status}`);

  r = await call(`/rest/v1/briefs?id=eq.${briefId}`, { method: "PATCH", token: b.token, headers: rep, body: JSON.stringify({ share_slug: "b".repeat(22) }) });
  expect("B cannot share A's brief", Array.isArray(r.body) && r.body.length === 0, `${r.status} rows=${r.body?.length}`);

  r = await call(`/rest/v1/briefs?id=eq.${briefId}`, { method: "DELETE", token: b.token, headers: rep });
  expect("B cannot delete A's brief", Array.isArray(r.body) && r.body.length === 0, `${r.status} rows=${r.body?.length}`);

  r = await call(`/rest/v1/briefs?id=eq.${briefId}`, { method: "PATCH", token: a.token, body: JSON.stringify({ act_name: "Tampered" }) });
  expect("A cannot edit a saved brief's content (only share_slug)", r.status === 401 || r.status === 403, `${r.status}`);

  r = await call(`/rest/v1/briefs?id=eq.${briefId}`, { method: "PATCH", token: a.token, headers: rep, body: JSON.stringify({ share_slug: slug }) });
  expect("A can share their own brief", r.status === 200 && r.body?.[0]?.share_slug === slug, `${r.status}`);

  r = await call("/rest/v1/briefs?select=*");
  expect("Logged-out visitors cannot list briefs", r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0), `${r.status}`);
  r = await call("/rest/v1/rpc/shared_brief", { method: "POST", body: JSON.stringify({ slug }) });
  expect("Logged-out visitors can open a shared brief by slug", r.status === 200 && r.body?.[0]?.act_name === "Khruangbin", `${r.status}`);
  expect("Shared brief exposes no user_id or brief id", r.body?.[0] && !("user_id" in r.body[0]) && !("id" in r.body[0]));
  r = await call("/rest/v1/rpc/shared_brief", { method: "POST", body: JSON.stringify({ slug: "x".repeat(24) }) });
  expect("A wrong slug returns nothing", r.status === 200 && r.body?.length === 0, `${r.status}`);

  r = await call("/rest/v1/rpc/delete_my_account", { method: "POST", body: "{}" });
  expect("Logged-out visitors cannot call delete_my_account", r.status === 401 || r.status === 403 || r.status === 404, `${r.status}`);
} finally {
  for (const [name, u] of [["A", a], ["B", b]] as const) {
    const r = await call("/rest/v1/rpc/delete_my_account", { method: "POST", token: u.token, body: "{}" });
    expect(`${name} deletes their account`, r.status === 204 || r.status === 200, `${r.status}`);
  }
  const r = await call("/rest/v1/rpc/shared_brief", { method: "POST", body: JSON.stringify({ slug }) });
  expect("Deleting an account removes its briefs (shared link stops working)", r.status === 200 && r.body?.length === 0, `${r.status} rows=${r.body?.length}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll RLS checks passed");
process.exitCode = failures ? 1 : 0;
