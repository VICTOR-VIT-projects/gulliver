import { searchActs } from "@/lib/gulliver";
import { QlooError } from "@/lib/qloo";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ acts: [] });

  try {
    return Response.json({ acts: await searchActs(q) });
  } catch (err) {
    if (!(err instanceof QlooError)) console.error(err);
    return Response.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
