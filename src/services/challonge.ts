/** Fetch for Challonge API integration.
 * @const
 */
import fetch from "node-fetch";

import Utils from "../utility/utils.js";

/** Database module.
 * @const
 */
import db from "../services/db.js";


/** 
 * @const
 * Global Server Sent Emitter class for real time data.
 */
import GlobalEmitter from "../utility/emitter.js";

/*** A PUT call to Challonge to update a match that is currently being played.
 * @function
 * @memberof module:legacy/api
 * @param {number} match_id - The internal ID of the match being played.
 * @param {number} season_id - The internal ID of the current season of the match being played.
 * @param {number} team1_id - The internal team ID of the first team.
 * @param {number} team2_id - The internal team ID of the second team.
 * @param {number} num_maps - The number of maps in the current match.
 * @param {string} [winner=null] - The string value representing the winner of the match.
 */
async function update_challonge_match(match_id: number, season_id: number, team1_id: number, team2_id: number, num_maps: number, winner: string | null = null) {
    // Check if a match has a season ID.
    let sql: string = "SELECT id, challonge_url, user_id FROM season WHERE id = ?";
    let team1Score: number;
    let team2Score: number;
    const seasonInfo: any = await db.query(sql, season_id);
    if (seasonInfo[0].challonge_url) {
      sql = "SELECT challonge_team_id FROM team WHERE id = ?";
      const team1ChallongeId: any = await db.query(sql, team1_id);
      const team2ChallongeId: any = await db.query(sql, team2_id);
  
      // Grab API key.
      sql = "SELECT challonge_api_key FROM user WHERE id = ?";
      const challongeAPIKey: any = await db.query(sql, [seasonInfo[0].user_id]);
      let decryptedKey: string = Utils.decrypt(challongeAPIKey[0].challonge_api_key);
      // Get info of the current open match with the two IDs.
      let challongeResponse = await fetch(
        "https://api.challonge.com/v1/tournaments/" +
        seasonInfo[0].challonge_url +
        "/matches.json?api_key=" + decryptedKey +
        "&state=open&participant_id=" +
        team1ChallongeId[0].challonge_team_id +
        "&participant_id=" +
        team2ChallongeId[0].challonge_team_id);
      let challongeData: any = await challongeResponse.json();
      if (challongeData) {
        if (num_maps == 1) {
          // Submit the map stats scores instead.
          sql = "SELECT team1_score, team2_score FROM map_stats WHERE match_id = ?";
        } else {
          sql = "SELECT team1_score, team2_score FROM `match` WHERE id = ?";
        }
        const mapStats: any = await db.query(sql, [match_id]);
        // Admins may just make a match that has teams swapped. This is okay as we can change what we
        // report to Challonge.
        team1Score = challongeData[0].match.player1_id == team1ChallongeId[0].challonge_team_id
          ? mapStats[0].team1_score
          : mapStats[0].team2_score;
        team2Score = challongeData[0].match.player2_id == team2ChallongeId[0].challonge_team_id
          ? mapStats[0].team2_score
          : mapStats[0].team1_score;
        // Build the PUT body.
        let putBody = {
          api_key: decryptedKey,
          match: {
            scores_csv: `${team1Score}-${team2Score}`,
            winner_id: winner === "team1"
              ? team1ChallongeId[0].challonge_team_id
              : team2ChallongeId[0].challonge_team_id
          }
        };
        // If we're just updating the score, remove this.
        if (winner === null) {
          delete putBody.match.winner_id;
        }
        await fetch(
          "https://api.challonge.com/v1/tournaments/" +
          seasonInfo[0].challonge_url +
          "/matches/" +
          challongeData[0].match.id +
          ".json", {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(putBody)
        });
        // Check and see if any matches remain, if not, finalize the tournament.
        challongeResponse = await fetch(
          "https://api.challonge.com/v1/tournaments/" +
          seasonInfo[0].challonge_url +
          "/matches.json?api_key=" + decryptedKey +
          "&state=open"
        );
        challongeData = await challongeResponse.json();
        if (!challongeData) {
          await fetch(
            "https://api.challonge.com/v1/tournaments/" +
            seasonInfo[0].challonge_url +
            "finalize.json?api_key=" + decryptedKey,
            {
              method: 'POST'
            }
          );
          // If we are the last map, let's close off the season as well.
          sql = "UPDATE season SET end_date = ? WHERE id = ?";
          await db.query(sql, [new Date().toISOString().slice(0, 19).replace("T", " "), seasonInfo[0].id]);
          GlobalEmitter.emit("seasonUpdate");
        }
      }
    }
  }