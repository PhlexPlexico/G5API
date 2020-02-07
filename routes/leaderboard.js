/** Express API router for users in get5.
 * @module routes/leaderboard
 * @requires express
 * @requires db
 */
const express = require("express");

/** Express module
 * @const
 */

const router = express.Router();
/** Database module.
 * @const
 */

const db = require("../db");

/** GET - Route serving to get lifetime leaderboard of teams.
 * @name router.get('/')
 * @function
 * @memberof module:routes/leaderboard
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/", async (req, res) => {
  try {
    let leaderboard = await getTeamLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

 const getTeamLeaderboard = async (seasonId=null) => {
    // Logic:
    /*
    * 1. Get all matches.
    * 2. Loops through each match id, and get all map stats.
    * 3. Store all map stats for each unique team.
    * 4. Return all stats. Doesn't matter if sorted, front-end should take care of it?
    */
    let allMatches = null;
    let winningRounds,losingRounds = 0;
    let teamStandings = {};
    let matchSql = "";
    if(!seasonId){
        matchSql = "SELECT id FROM `match` WHERE end_time IS NOT NULL AND winner IS NOT NULL AND cancelled = false";
        allMatches = await db.query(matchSql);
    }
    else{
        matchSql = "SELECT id FROM `match` WHERE end_time IS NOT NULL AND winner IS NOT NULL AND cancelled = FALSE AND season_id = ?";
        allMatches = await db.query(matchSql, [seasonId]);
    }
    // Loop through all matches and start grabbing.
    for (const match of allMatches) {
        // Query for stats.
        let mapStatSql = "SELECT * FROM map_stats WHERE match_id = ? AND winner IS NOT NULL";
        const mapStats = await db.query(mapStatSql, match.id);
        for (const stats in mapStats) {

        }
    }
}


module.exports = router;