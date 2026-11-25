/**
 * Routes match updates to the bracket provider of the match's season.
 *
 * A season is imported either from Challonge or from Toornament; each provider
 * has its own reporting behaviour, so callers only signal what happened.
 *
 * @module services/tournament
 */

import { RowDataPacket } from "mysql2";

import { db } from "./db.js";
import update_challonge_match from "./challonge.js";
import { update_toornament_match, TournamentEvent } from "./toornament.js";

export type { TournamentEvent };

/** Reports a match event to the bracket of its season, if any. Never throws.
 * @param {TournamentEvent} event - `live` (round score), `map_end` or `series_end`.
 * @param {number | string} match_id - The internal match ID.
 * @param {number} season_id - The internal season ID.
 * @param {number} team1_id - The internal ID of the first team.
 * @param {number} team2_id - The internal ID of the second team.
 * @param {number} num_maps - The number of maps of the match.
 * @param {string | null} [winner=null] - `team1`, `team2` or `none` at series end.
 */
export default async function update_tournament_match(
  event: TournamentEvent,
  match_id: number | string | null,
  season_id: number,
  team1_id: number,
  team2_id: number,
  num_maps: number,
  winner: string | null = null
): Promise<void> {
  try {
    if (match_id == null) return;
    const season: RowDataPacket[] = await db.query(
      "SELECT is_challonge, is_toornament FROM season WHERE id = ?",
      [season_id]
    );
    if (!season[0]) return;

    if (season[0].is_toornament) {
      await update_toornament_match(event, match_id, season_id, winner);
      return;
    }

    // Challonge gets the live round score of a BO1, and the series score after each map otherwise.
    if (event === "live" && num_maps != 1) return;
    if (event === "map_end" && num_maps == 1) return;
    await update_challonge_match(match_id, season_id, team1_id, team2_id, num_maps, winner);
  } catch (err) {
    console.error(`Failed to update tournament match ${match_id}: ${err}`);
  }
}
