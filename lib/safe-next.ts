const PROBE_ORIGIN = "http://gulliver.invalid";

/**
 * Post-login destination guard: only same-site paths survive. Control characters and backslashes
 * are rejected up front because URL parsers strip or normalise them, which can turn "/\t/evil.com"
 * into "//evil.com". The value is then resolved and must keep our origin.
 */
export function safeNext(value: unknown, fallback = "/board"): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  return url.origin === PROBE_ORIGIN ? url.pathname + url.search + url.hash : fallback;
}
