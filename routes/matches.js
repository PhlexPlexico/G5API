/** Express API router for users in get5.
 * @module routes/matches
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

/** Random string generator for API keys.
 * @const
 */
const randString = require("randomstring");

/** Ensures the user was authenticated through steam OAuth.
 * @function
 * @memberof module:routes/users
 * @function
 * @inner */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/auth/steam");
}

/** GET - Route serving to get all matches.
 * @name router.get('/')
 * @function
 * @memberof module:routes/matches
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `match` WHERE cancelled = 0";
    const matches = await db.query(sql);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get all matches.
 * @name router.get('/mymatches')
 * @function
 * @memberof module:routes/matches
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
router.get("/mymatches", ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `match` WHERE user_id = ?";
    const matches = await db.query(sql, [req.user.id]);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get a set of map stats from a match.
 * @name router.get('/:match_id')
 * @memberof module:routes/matches
 * @function
 * @param {string} path - Express path
 * @param {number} request.params.match_id - The ID of the match containing the statistics.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    //
    matchID = req.params.match_id;
    let sql = "SELECT * FROM `match` where id = ?";
    const matches = await db.query(sql, matchID);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to forfeit a match.
 * @name router.get('/:match_id/forfeit/:winner')
 * @memberof module:routes/matches
 * @function
 * @param {string} path - Express path
 * @param {number} request.params.match_id - The ID of the match containing the statistics.
 * @param {number} request.params.winner - The team which one. 1 for team1, 2 for team2.
 * @param {callback} middleware - Express middleware.
 */
router.get(
  "/:match_id/forfeit/:winner",
  ensureAuthenticated,
  async (req, res, next) => {
    try {
      let matchID = parseInt(req.params.match_id);
      let winner = parseInt(req.params.winner);
      let winningTeamId;
      let matchTime = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      let sql = "SELECT * FROM `match` where id = ?";
      const matches = await db.query(sql, matchID);
      // Check if match owner is the the one calling or is a super_admin.
      if (matches[0].user_id !== req.user.id) {
        if (req.user.super_admin === 0)
          res
            .status(401)
            .json({ message: "Cannot forfeit a match you don't own." });
      }
      if (winner !== 1 || winner !== 2) {
        res
          .status(401)
          .json({
            message:
              "You did not choose a correct team (1 or 2). Spectators cannot win."
          });
      } else if (winner === 1) {
        winningTeamId = matches[0].team1_id;
      } else if (winner === 2) {
        winningTeamId = matches[0].team2_id;
      }
      // Check for mapstats and create if none.
      sql = "SELECT * FROM map_stats where match_id = ?";
      const map_stat = await db.query(sql, matchID);
      if (map_stat.length > 0) {
        await db.withTransaction(db, async () => {
          let eTime = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
          sql =
            "UPDATE map_stats SET end_time = ?, map_name = ? WHERE match_id = ? AND map_number = 0";
          await db.query(sql, [eTime, "", matchID]);
        });
      } else {
        let allTime = new Date()
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        sql =
          "INSERT INTO map_stats (match_id, map_number, map_name, start_time, end_time) VALUES (?,?,?,?)";
        await db.withTransaction(db, async () => {
          await db.query(sql, [matchID, 0, "", allTime, allTime]);
        });
      }
      // Now update match values.
      await db.withTransaction(db, async () => {
        sql = "UPDATE `match` SET ? WHERE id = ?";
        let updateSet = {
          team1_score: winner === 1 ? 16 : 0,
          team2_score: winner === 2 ? 16 : 0,
          start_time: matchTime,
          end_time: matchTime,
          forfeit: 1,
          winner: winningTeamId
        };
        await db.query(sql, [updateSet, matchID]);
        // Update match server to set not in use.
        sql = "UPDATE game_server SET in_use = 0 WHERE match_id = ?";
        await db.query(sql, [matchID]);
      });
      res.redirect("/mymatches");
    } catch (err) {
      res.status(500).json({ message: err });
    }
  }
);

/** GET - Route serving to get a set of matches with a limit for recent matches.
 * @name router.get('/limit/:limit')
 * @memberof module:routes/matches
 * @function
 * @param {string} path - Express path
 * @param {number} request.params.limiter - The number to limit the query by.
 * @param {callback} middleware - Express middleware.
 */
router.get("/limit/:limiter", async (req, res, next) => {
  try {
    let lim = parseInt(req.params.limiter);
    let sql = "SELECT * FROM `match` ORDER BY end_time DESC LIMIT ?";
    const matches = await db.query(sql, lim);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get match configs from the database for the plugin.
 * @name router.get('/:match_id/config')
 * @memberof module:routes/matches
 * @function
 * @param {string} path - Express path
 * @param {number} request.params.match_id - The ID of the match containing the statistics.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:match_id/config", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM `match` WHERE id = ?";
    let matchID = parseInt(req.params.match_id);
    const matchInfo = await db.query(sql, [matchID]);
    let matchJSON = {
      matchid: matchID,
      match_title: matchInfo[0].title,
      side_type: matchInfo[0].side_type,
      veto_first: matchInfo[0].veto_first,
      skip_veto: matchInfo[0].skip_veto,
      min_players_to_ready:
        matchInfo[0].min_player_ready !== null
          ? matchInfo[0].min_player_ready
          : 5,
      players_per_team:
        matchInfo[0].min_player_ready !== null
          ? matchInfo[0].min_player_ready
          : 5,
      team1: {},
      team2: {},
      cvars: {
        get5_web_api_url: "http://" + req.get("host") + "/",
        get5_check_auths: matchInfo[0].enforce_teams
      },
      spectators: {},
      maplist:
        matchInfo[0].veto_mappool !== null
          ? matchInfo[0].veto_mappool.split(" ")
          : null,
      min_spectators_to_ready: 0
    };
    if (matchInfo[0].max_maps === 2) {
      matchJSON.bo2_series = true;
    } else {
      matchJSON.maps_to_win = parseInt(matchInfo[0].max_maps / 2 + 1);
    }
    // Fill out team data.
    // Start with team 1
    sql = "SELECT * FROM team WHERE id = ?";
    const team1Data = await db.query(sql, [matchInfo[0].team1_id]);
    const team2Data = await db.query(sql, [matchInfo[0].team2_id]);
    matchJSON.team1 = await build_team_dict(team1Data[0], 1, matchInfo[0]);
    matchJSON.team2 = await build_team_dict(team2Data[0], 2, matchInfo[0]);
    res.json(matchJSON);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

/** POST - Create a veto object from a given match.
 * @name router.post('/create')
 * @memberof module:routes/matches
 * @function
 * @param {int} req.body[0].user_id - The ID of the user creating the match.
 * @param {int} req.body[0].server_id - The server ID the match is being designated to. NULL if to be provided later.
 * @param {int} req.body[0].team1_id - The ID of team one.
 * @param {int} req.body[0].team2_id - The ID of team two.
 * @param {int} req.body[0].season_id - The ID of the season. NULL if no season.
 * @param {DateTime} req.body[0].start_time - The starting time of the match.
 * @param {int} req.body[0].max_maps - The number of max maps played per series.
 * @param {string} req.body[0].title - The title of the match, default is 'Map {MAPNUMBER} of {MAXMAPS}'.
 * @param {boolean} req.body[0].skip_veto - Boolean value representing whether to skip the veto or not.
 * @param {string} req.body[0].veto_first - The string value team1 or team2 on who gets to veto first.
 * @param {string} req.body[0].veto_mappool - The map pool given by the system. Space separated.
 * @param {string} req.body[0].side_type - Decision on what to do for side types. standard, always_knife, etc.
 * @param {JSON} req.body[0].spectator_auths - JSON array of spectator auths.
 * @param {boolean} req.body[0].private_match - Boolean value representing whether the match is limited visibility to users on the team or who is on map stats. Defaults to false.
 * @param {boolean} req.body[0].enforce_teams - Boolean value representing whether the server will enforce teams on match start. Defaults to true.
 */
router.post("/create", ensureAuthenticated, async (req, res, next) => {
  try {
    await db.withTransaction(db, async () => {
      let insertSet = {
        user_id: req.body[0].user_id,
        server_id: req.body[0].server_id,
        team1_id: req.body[0].team1_id,
        team2_id: req.body[0].team2_id,
        season_id: req.body[0].season_id,
        start_time: req.body[0].start_time,
        max_maps: req.body[0].max_maps,
        title: req.body[0].title,
        skip_veto: req.body[0].skip_veto,
        veto_first: req.body[0].veto_first,
        veto_mappool: req.body[0].veto_mappool,
        side_type: req.body[0].side_type || "standard",
        private_match: req.body[0].private_match || 0,
        enforce_teams: req.body[0].enforce_teams || 1,
        api_key: randString.generate({
          length: 24,
          capitalization: uppercase
        })
      };
      let sql = "INSERT INTO `match` SET ?";
      await db.query(sql, [insertSet]);
      sql = "INSERT match_spectator (match_id, auth) VALUES (?,?)";
      for (let key in req.body[0].spectator_auths) {
        await db.query(sql, [req.body[0].match_id, key]);
      }
      res.json("Match inserted successfully!");
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** PUT - Create a veto object from a given match.
 * @name router.post('/update')
 * @memberof module:routes/matches
 * @function
 * @param {int} req.body[0].match_id - The ID of the user creating the match.
 * @param {int} req.body[0].user_id - The ID of the user creating the match.
 * @param {DateTime} req.body[0].end_time - The end time of the match.
 * @param {int} req.body[0].winner - The ID of the team who won the series.
 * @param {string} req.body[0].plugin_version - The version of the get5 plugin running on the server.
 * @param {boolean} req.body[0].forfeit - Boolean value representing whether the match was forfeit.
 * @param {string} req.body[0].cancelled - Boolean value representing whether the match was cancelled.
 * @param {int} req.body[0].team1_score - The score of team1 during the series.
 * @param {string} req.body[0].team2_score - The score of team2 during the series.
 * @param {JSON} req.body[0].spectator_auths - JSON array of spectator auths.
 * @param {boolean} req.body[0].private_match - Boolean value representing whether the match is limited visibility to users on the team or who is on map stats.
 */
router.put("/update", ensureAuthenticated, async (req, res, next) => {
  try {
    let userId = req.user.id;
    let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(matchUserId, req.body[0].match_id);
    if (
      req.user.super_admin ||
      req.user.admin === 1 ||
      matchRow[0].user_id === userId
    ) {
      await db.withTransaction(db, async () => {
        // Use passport auth here, and then also check user to see if they own or are admin of match.
        let updateStmt = {
          user_id: req.body[0].user_id,
          end_time: req.body[0].end_time,
          winner: req.body[0].winner,
          plugin_version: req.body[0].plugin_version,
          forfeit: req.body[0].forfeit,
          cancelled: req.body[0].cancelled,
          team1_score: req.body[0].team1_score,
          team2_score: req.body[0].team2_score,
          private_match: req.body[0].private_match
        };
        // Remove any values that may not be updated.
        updateStmt = await db.buildUpdateStatement(updateStmt);
        let sql = "UPDATE `match` SET ? WHERE id = ?";
        await db.query(sql, [updateStmt, req.body[0].match_id]);
        sql = "INSERT match_spectator (match_id, auth) VALUES (?,?)";
        for (let key in req.body[0].spectator_auths) {
          await db.query(sql, [req.body[0].match_id, key]);
        }
        res.json("Match updated successfully!");
      });
    } else {
      res
        .status(401)
        .json({ message: "You are not authorized to perform this task." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

/** DEL - Delete all match data associated with a match, including stats, vetoes, etc.
 * @name router.delete('/delete')
 * @memberof module:routes/matches
 * @function
 * @param {int} req.body[0].user_id - The ID of the user deleteing. Can check if admin when implemented.
 * @param {int} req.body[0].match_id - The ID of the match to remove all values pertaining to the match.
 *
 */
router.delete("/delete", async (req, res, next) => {
  try {
    await db.withTransaction(db, async () => {
      let userId = req.user.id;
      let matchId = req.body[0].match_id;
      let isMatchCancelled =
        "SELECT cancelled, user_id from `match` WHERE id = ?";
      // First find any matches/mapstats/playerstats associated with the team.
      let playerStatDeleteSql = "DELETE FROM player_stats WHERE match_id = ?";
      let mapStatDeleteSql = "DELETE FROM map_stats WHERE match_id = ?";
      let spectatorDeleteSql = "DELETE FROM match_spectator WHERE match_id = ?";
      const matchCancelledResult = await db.query(isMatchCancelled, matchId);
      if (matchCancelledResult[0].cancelled !== 1) {
        throw "Cannot delete match as it is not cancelled.";
      } else if (matchCancelledResult[0].user_id !== userId) {
        res
          .status(401)
          .json("You do not have authorized access to delete these matches.");
      }
      // Do we even allow this? Maybe only when matches are cancelled?
      let deleteMatchsql = "DELETE FROM `match` WHERE id = ?";
      const deletePlayerStatRows = await db.query(playerStatDeleteSql, matchId);
      const deleteMapStatRows = await db.query(mapStatDeleteSql, matchId);
      const deleteSpectatorRows = await db.query(spectatorDeleteSql, matchId);
      const delRows = await db.query(sql, matchId);
      if (delRows.affectedRows > 0) res.json("Match deleted successfully!");
      else res.status(401).json("Match is not found.");
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

// Helper functions
async function build_team_dict(team, teamNumber, matchData) {
  let sql = "SELECT auth, name FROM team_auth_names WHERE team_id = ?";
  const playerAuths = await db.query(sql, [team.id]);
  let normalizedAuths = {};
  for (let i = 0; i < playerAuths.length; i++) {
    const key = playerAuths[i].auth;
    normalizedAuths[key] = playerAuths[i].name;
  }
  let teamData = {
    name: team.name,
    tag: team.tag,
    flag: team.flag.toUpperCase(),
    logo: team.logo,
    matchtext: team.matchtext,
    players: normalizedAuths,
    series_score:
      teamNumber === 1
        ? matchData.team1_series_score
        : matchData.team2_series_score,
    matchtext:
      teamNumber === 1 ? matchData.team1_string : matchData.team2_string
  };
  for (let key in teamData) {
    if (teamData[key] === null) delete teamData[key];
  }
  return teamData;
}

module.exports = router;
