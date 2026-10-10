import { gatherBrief } from "@/lib/brief";
import { QlooError } from "@/lib/qloo";
import { currentUser } from "@/lib/supabase/server";

const ENTITY_ID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // A session (guest counts) is required: each brief spends ~10 calls of a shared monthly Qloo quota,
  // and Supabase rate-limits guest sign-ins per IP.
  if (!(await currentUser())) return Response.json({ error: "Sign in or continue as a guest first." }, { status: 401 });

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
