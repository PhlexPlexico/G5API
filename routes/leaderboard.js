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

/** Function to get the current leaderboard standings in a season, or all time.
 * @function
 * @memberof module:routes/leaderboard
 * @function
 * @inner */
 const getTeamLeaderboard = async (seasonId = null) => {
  try {
    /* Logic:
     * 1. Get all matches.
     * 2. Loops through each match id, and get all map stats.
     * 3. Store all map stats for each unique team.
     * 4. Return all stats. Doesn't matter if sorted, front-end should take care of it?
     */
    let allMatches = null;
    let winningRounds,
      losingRounds = 0;
    let teamStandings = {};
    let matchSql = "";
    if (!seasonId) {
      matchSql =
        "SELECT id, team1_id, team2_id FROM `match` WHERE end_time IS NOT NULL AND winner IS NOT NULL AND cancelled = false";
      allMatches = await db.query(matchSql);
    } else {
      matchSql =
        "SELECT id, team1_id, team2_id FROM `match` WHERE end_time IS NOT NULL AND winner IS NOT NULL AND cancelled = FALSE AND season_id = ?";
      allMatches = await db.query(matchSql, [seasonId]);
    }
    for (let match of allMatches) {
      let mapStatSql =
        "SELECT * FROM map_stats WHERE match_id = ? AND winner IS NOT NULL";
      let teamSelectSql = "SELECT id, name FROM team WHERE id = ?";
      let winningTeam, losingTeam;
      const mapStats = await db.query(mapStatSql, match.id);
      for (let stats of mapStats) {
        winningRounds = 0; 
        losingRounds = 0;
        winningTeam = await db.query(teamSelectSql, [stats.winner]);
        if (winningTeam[0].id === match.team1_id) {
          losingTeam = await db.query(teamSelectSql, [match.team2_id]);
          winningRounds += stats.team1_score;
          losingRounds += stats.team2_score;
        } else {
          losingTeam = await db.query(teamSelectSql, [match.team1_id]);
          winningRounds += stats.team2_score;
          losingRounds += stats.team1_score;
        }
        let winName = winningTeam[0].name;
        let loseName = losingTeam[0].name;
        // Instantiate the object, needed only once.
        if(!teamStandings[winName]) {
          teamStandings[winName] = {};
          teamStandings[winName].wins = 0;
          teamStandings[winName].losses = 0;
          teamStandings[winName].rounddiff = 0;
        }
        if (!teamStandings[loseName]){
          teamStandings[loseName] = {};
          teamStandings[loseName].wins = 0;
          teamStandings[loseName].losses = 0;
          teamStandings[loseName].rounddiff = 0;
        }
        console.log("Win rounds: " + winningRounds + "\nLosing: " + losingRounds);
        teamStandings[winName].teamid = winningTeam[0].id;
        teamStandings[winName].wins += 1;
        teamStandings[winName].rounddiff +=
          winningRounds - losingRounds;
        teamStandings[loseName].teamid = losingTeam[0].id;
        teamStandings[loseName].losses += 1;
        teamStandings[loseName].rounddiff +=
          losingRounds - winningRounds;
      }
    }
    return teamStandings;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

module.exports = router;
