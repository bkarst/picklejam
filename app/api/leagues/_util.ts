/**
 * _util.ts — shared parsing/validation for the /api/leagues/* route handlers
 * (`_`-prefixed so Next never treats it as a route). Maps a thrown
 * {@link LeagueError} (400/403/404/409) to the JSON error `Response` shape, and
 * re-exports the generic field parsers (they carry no tournament coupling).
 */

import { bad } from "@/app/api/_util";
import { LeagueError } from "@/lib/data/leagues";

export { reqStr, optStr, optNum, optInt, reqPrice } from "@/app/api/tournaments/_util";

export const MAX_TITLE = 140;
export const MAX_DESC = 4000;

/** Map a thrown domain {@link LeagueError} → a JSON error Response; rethrow others. */
export function leagueErr(err: unknown): never {
  if (err instanceof LeagueError) bad(err.message, err.status);
  throw err;
}
