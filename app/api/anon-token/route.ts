/**
 * POST /api/anon-token — mint an ephemeral anonymous browser token (PRD §6.2).
 *
 * Lets a signed-out client obtain a token up front (e.g. before a check-in) and
 * persist it. The token is random + TTL'd and never identity-linked. No auth.
 */

import { issueAnonToken } from "@/lib/data/anon";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const token = await issueAnonToken();
  return Response.json({ token });
}
