// node scripts/check-safe-next.ts — every case must stay on-site.
import assert from "node:assert/strict";
import { safeNext } from "../lib/safe-next.ts";

const fallback = "/board";
const external = [
  "//evil.com",
  "/\\evil.com",
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  decodeURIComponent("%2F%09%2Fevil.com"),
  "https://evil.com",
  "evil.com",
  "/%2F%2Fevil.com/..", // stays a path; must not become external
  "",
  null,
];

for (const v of external) {
  const out = safeNext(v);
  assert.ok(out.startsWith("/") && !out.startsWith("//"), `${JSON.stringify(v)} -> ${out}`);
  assert.equal(new URL(out, "https://gulliver.app").origin, "https://gulliver.app", `${JSON.stringify(v)} escaped`);
}

assert.equal(safeNext("/brief/ABC?tab=openers#e3"), "/brief/ABC?tab=openers#e3");
assert.equal(safeNext("/board"), "/board");
assert.equal(safeNext("//evil.com"), fallback);
assert.equal(safeNext("/\t/evil.com"), fallback);

console.log(`safeNext: ${external.length + 4} cases ok`);
