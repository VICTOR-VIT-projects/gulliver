import { gatherBrief } from "@/lib/brief";
import { QlooError } from "@/lib/qloo";

const ENTITY_ID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ENTITY_ID.test(id)) return Response.json({ error: "Unknown act." }, { status: 400 });

  try {
    const brief = await gatherBrief(id);
    if (!brief) return Response.json({ error: "Unknown act." }, { status: 404 });
    return Response.json(brief);
  } catch (err) {
    if (!(err instanceof QlooError)) console.error(err);
    return Response.json({ error: "Couldn't reach Qloo. Try again in a moment." }, { status: 502 });
  }
}
