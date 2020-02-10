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

/** GET - Route serving to get a season leaderboard of teams.
 * @name router.get('/:season_id')
 * @function
 * @memberof module:routes/leaderboard
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/:season_id", async (req, res) => {
  try {
    let seasonId = req.params.season_id;
    let leaderboard = await getTeamLeaderboard(seasonId);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get a lifetime leaderboard for players.
 * @name router.get('/players')
 * @function
 * @memberof module:routes/leaderboard
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/players", async (req, res) => {
  try {
    let leaderboard = await getPlayerLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** Function to get the current team leaderboard standings in a season, or all time.
 * @function
 * @memberof module:routes/leaderboard
 * @param {string} [seasonId=null] - Season ID to filter.
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
    let teamStandings = [];
    let teamValues = {};
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
        if(!teamStandings.some(el => el.name === winName)) {
          teamStandings.push({name: winName, wins: 0, losses: 0, rounddiff: 0})
        }
        if(!teamStandings.some(el => el.name === loseName)) {
          teamStandings.push({name: loseName, wins: 0, losses: 0, rounddiff: 0})
        }
        let winners = teamStandings.find((team) => {return team.name === winName});
        winners.wins += 1;
        winners.rounddiff += (winningRounds - losingRounds);
        let losers = teamStandings.find((team) => {return team.name === loseName});
        losers.losses += 1;
        losers.rounddiff += (losingRounds - winningRounds);
      }
    }
    return teamStandings;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

/** Function to get the current player leaderboard standings in a season, or all time.
 * @function
 * @memberof module:routes/leaderboard
 * @param {string} [seasonId=null] - Season ID to filter.
 * @function
 * @inner */
const getPlayerLeaderboard = async (seasonId = null) => { 
  let allPlayers = {};
  let playerStats;
  /* Logic:
  * 1. Get all player values where match is not cancelled or forfeit.
  * 2. Grab raw values, and calculate things like HSP and KDR for each user. Get names and cache 'em even.
  * 3. Insert into list of objects for each user.
  */
  let playerStatSql = `SELECT  steam_id, name, sum(kills), 
    sum(deaths), sum(assists), sum(k3), 
    sum(k4), sum(k5), sum(v1), 
    sum(v2), sum(v3), sum(v4), 
    sum(v5), sum(roundsplayed), sum(flashbang_assists), 
    sum(damage), sum(headshot_kills) 
    FROM    player_stats 
    WHERE   match_id IN (
        SELECT  id 
        FROM    \`match\` 
        WHERE   cancelled=0
    )
    GROUP BY steam_id, name`;
  let playerStatSqlSeasons = `SELECT  steam_id, name, sum(kills), 
    sum(deaths), sum(assists), sum(k3), 
    sum(k4), sum(k5), sum(v1), 
    sum(v2), sum(v3), sum(v4), 
    sum(v5), sum(roundsplayed), sum(flashbang_assists), 
    sum(damage), sum(headshot_kills) 
    FROM    player_stats, \`match\` 
    WHERE   match_id IN (
        SELECT  id 
        FROM    \`match\` 
        WHERE   cancelled=0
        AND season_id = ?
    )
    GROUP BY steam_id, name`;
  
  if(!seasonId)
    playerStats = await db.query(playerStatSql);
  else
    playerStats = await db.query(playerStatSqlSeasons, [seasonId]);

  for(let player of playerStats){
    // Players can have multiple names. Avoid collision by combining everything, then performing averages.
    if(!allPlayers.steamId) {

    }
  }
  
};
module.exports = router;
