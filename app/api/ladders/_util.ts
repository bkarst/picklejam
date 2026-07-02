/**
 * _util.ts — shared error mapping for the /api/ladders/* route handlers
 * (`_`-prefixed so Next never treats it as a route). Maps a thrown
 * {@link LadderError} (400/403/404/409) to the JSON error `Response` shape. The
 * generic field parsers (`reqStr`/`optStr`/`optNum`/`optInt`/`reqPrice`) are reused
 * from the tournaments util — they are product-agnostic.
 */

import { bad } from "@/app/api/_util";
import { LadderError } from "@/lib/data/ladders";

export { reqStr, optStr, optNum, optInt, reqPrice, MAX_TITLE, MAX_DESC } from "@/app/api/tournaments/_util";

/** Map a thrown domain {@link LadderError} → a JSON error Response; rethrow others. */
export function ladderErr(err: unknown): never {
  if (err instanceof LadderError) bad(err.message, err.status);
  throw err;
}
