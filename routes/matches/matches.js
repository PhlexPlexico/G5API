/** Express API router for matches in get5.
 * @module routes/matches/matches
 * @requires express
 * @requires db
 */
const express = require("express");

const router = express.Router();

const db = require("../../db");

const randString = require("randomstring");

const Utils = require("../../utility/utils");

const GameServer = require("../../utility/serverrcon");


/**
 * @swagger
 *
 * components:
 *   schemas:
 *     NewMatch:
 *       type: object
 *       required:
 *         - team1_id
 *         - team2_id
 *         - max_maps
 *         - title
 *         - skip_veto
 *         - veto_mappool
 *       properties:
 *         match_id:
 *           type: integer
 *           description: The integer ID from the database. 
 *         server_id:
 *           type: integer
 *           description: The server ID the match is being designated to. NULL if to be provided later.
 *         team1_id:
 *           type: integer
 *           description: The ID of team one.
 *         team2_id:
 *           type: integer
 *           description: The ID of team two.
 *         season_id:
 *           type: integer
 *           description: The ID of the season. NULL if no season.
 *         start_time:
 *           type: datetime
 *           description: The starting time of the match.
 *         end_time:
 *           type: datetime
 *           description: The ending time of the match.
 *         winner:
 *           type: integer
 *           description: The ID of winner of the match.
 *         max_maps:
 *           type: integer
 *           description: The number of max maps played per series.
 *         title:
 *           type: string
 *           description: The title of the match, default is 'Map {MAPNUMBER} of {MAXMAPS}'.
 *         skip_veto:
 *           type: boolean
 *           description: Boolean value representing whether to skip the veto or not.
 *         veto_first:
 *           type: string
 *           description: The string value team1 or team2 on who gets to veto first.
 *         veto_mappool:
 *           type: string
 *           description: The map pool given by the system. Space separated.
 *         side_type:
 *           type: string
 *           description: Decision on what to do for side types. standard, always_knife, etc.
 *         plugin_version:
 *           type: string
 *           description: The version of the get5 plugin running on the server.
 *         spectator_auths:
 *           type: object
 *           properties:
 *              key:
 *                type: string
 *                description: String reprsentation of a steam64 ID.
 *           description: JSON array of spectator auths.
 *         private_match:
 *           type: boolean
 *           description: Boolean value representing whether the match is limited visibility to users on the team or who is on map stats. Defaults to false.
 *         enforce_teams:
 *           type: boolean
 *           description: Boolean value representing whether the server will enforce teams on match start. Defaults to true.
 *         ignore_server:
 *           type: boolean
 *           description: Boolean value representing whether to integrate a game server.
 *         forfeit:
 *           type: boolean
 *           description: Whether the match was forfeited or not.
 *         cancelled:
 *           type: boolean
 *           description: Whether or not the match was cancelled.
 *         team1_score:
 *           type: integer
 *           description: The score from team 1 during the series.
 *         team2_score:
 *           type: integer
 *           description: The score from team 2 during the series.
 *     MatchData:
 *       allOf:
 *         - $ref: '#/components/schemas/NewMatch'
 *         - type: object
 *           properties:
 *             match_id:
 *               type: integer
 *     SimpleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *   responses:
 *     BadRequest:
 *       description: User does not own server or match not supplied.
 *     NotFound:
 *       description: The specified resource was not found.
 *     Unauthorized:
 *       description: Unauthorized.
 *     MatchFinished:
 *        description: Match already finished.
 *     MatchNotFound:
 *       description: Match not Found.
 *     NoMatchData:
 *       description: No match data provided.
 *     Error:
 *       description: Error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /matches/:
 *   get:
 *     description: Get all match data from the application.
 *     produces:
 *       - application/json
 *     tags:
 *       - matches
 *     responses:
 *       404:
 *         $ref: '#/components/responses/MatchesNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql =
      "SELECT id, user_id, server_id, team1_id, team2_id, winner, team1_score, team2_score, team1_series_score, team2_series_score, team1_string, team2_string, cancelled, forfeit, start_time, end_time, max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, season_id FROM `match` WHERE cancelled = 0";
    const matches = await db.query(sql);
    if (matches.length === 0) {
      res.status(404).json({ message: "No matches found." });
      return;
    }
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches/mymatches:
 *   get:
 *     description: Set of matches from the logged in user.
 *     produces:
 *       - application/json
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Matches of logged in user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/MatchesNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/mymatches", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `match` WHERE user_id = ?";
    const matches = await db.query(sql, [req.user.id]);
    if (matches.length === 0) {
      res.status(404).json({ message: "No matches found." });
      return;
    }
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches/:match_id:
 *   get:
 *     description: Returns a provided matches info.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         type: integer
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/MatchNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
    let sql;
    const matchRow = await db.query(matchUserId, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      matchRow[0].user_id == req.user.id ||
      Utils.superAdminCheck(req.user)
    ) {
      sql = "SELECT * FROM `match` where id=?";
    } else {
      sql =
        "SELECT id, user_id, server_id, team1_id, team2_id, winner, team1_score, team2_score, team1_series_score, team2_series_score, team1_string, team2_string, cancelled, forfeit, start_time, end_time, max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, season_id FROM `match` where id = ?";
    }
    matchID = req.params.match_id;
    const matches = await db.query(sql, matchID);
    if (matches.length === 0) {
      res.status(404).json({ message: "No matches found." });
      return;
    }
    res.json(matches);
  } catch (err) {
    console.log(err.toString());
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches/limit/:limiter:
 *   get:
 *     description: Returns most recent matches specified by a limit.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: limiter
 *         required: true
 *         type: integer
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/limit/:limiter", async (req, res, next) => {
  try {
    let lim = parseInt(req.params.limiter);
    let sql = "SELECT * FROM `match` ORDER BY end_time DESC LIMIT ?";
    const matches = await db.query(sql, lim);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});


/**
 * @swagger
 *
 * /matches/:match_id:/config:
 *   get:
 *     description: Route serving to get match configs from the database for the plugin.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         type: integer
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/MatchNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id/config", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM `match` WHERE id = ?";
    let matchID = parseInt(req.params.match_id);
    const matchInfo = await db.query(sql, [matchID]);
    if (matchInfo.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    }
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
        get5_check_auths: matchInfo[0].enforce_teams,
      },
      spectators: {},
      maplist:
        matchInfo[0].veto_mappool !== null
          ? matchInfo[0].veto_mappool.split(" ")
          : null,
      min_spectators_to_ready: 0,
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
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches:
 *   post:
 *     description: Create a new match.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewMatch'
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Create successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if server available, if we are given a server.
    let serverSql = "SELECT in_use, user_id, public_server FROM game_server WHERE id = ?";
    if (req.body[0].server_id != null) {
      const serverInUse = await db.query(serverSql, [req.body[0].server_id]);
      if (serverInUse[0].in_use) {
        res.status(401).json({
          message:
            "Server is already in use, please select a different server.",
        });
        return;
      } else if (
        serverInUse[0].user_id != req.user.id &&
        !Utils.superAdminCheck(req.user) &&
        serverInUse[0].public_server == 0
      ) {
        res.status(403).json({ message: "User does not own this server." });
        return;
      }
    }
    let apiKey = randString.generate({
      length: 24,
      capitalization: "uppercase",
    });
    await db.withTransaction(async () => {
      let insertSet = {
        user_id: req.user.id,
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
        side_type:
          req.body[0].side_type == null ? "standard" : req.body[0].side_type,
        plugin_version: req.body[0].plugin_version,
        private_match:
          req.body[0].private_match == null ? 0 : req.body[0].private_match,
        enforce_teams:
          req.body[0].enforce_teams == null ? 1 : req.body[0].enforce_teams,
        api_key: apiKey,
        winner: null,
      };
      let sql = "INSERT INTO `match` SET ?";
      insertSet = await db.buildUpdateStatement(insertSet);
      await db.query(sql, [insertSet]);
      sql = "INSERT match_spectator (match_id, auth) VALUES (?,?)";
      for (let key in req.body[0].spectator_auths) {
        await db.query(sql, [req.body[0].match_id, key]);
      }
      if (!req.body[0].ignore_server) {
        let ourServerSql = "SELECT rcon_password, ip_string, port FROM game_server WHERE id=?";
        const serveInfo = await db.query(ourServerSql, [req.body[0].server_id])
        const newServer = new GameServer(
          serveInfo[0].ip_string,
          serveInfo[0].port,
          null,
          serveInfo[0].rcon_password
        );
        if (
          (await newServer.isServerAlive()) &&
          (await newServer.isGet5Available())
        ) {
          if (!(await newServer.prepareGet5Match(req.get("Host"), apiKey))) {
            res.status(500).json({
              message:
                "Please check server logs, as something was not set properly. You may cancel the match and server status is not updated.",
            });
            return;
          }
        }
      }
      if (req.body[0].server_id) {
        sql = "UPDATE game_server SET in_use = 1 WHERE id = ?";
        await db.query(sql, [req.body[0].server_id]);
      }
      res.json({ message: "Match inserted successfully!" });
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches:
 *   put:
 *     description: Update player stats in a match/map.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewMatch'
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Update successful.
 *         content:
 *           application/json:
 *             type: object
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/MatchesNotFound'
 *       412:
 *         $ref: '#/components/responses/NoMatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let diffServer = false;
    let ourServerSql = "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
    if (req.body[0].match_id == null) {
      res.status(404).json({ message: "Match ID Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, api_key FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.body[0].match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      matchRow[0].user_id != req.user.id &&
      !Utils.superAdminCheck(req.user)
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      if (req.body[0].server_id != null) {
        // Check if server is owned, public, or in use by another match.
        let serverCheckSql =
          "SELECT in_use, user_id, public_server FROM game_server WHERE id=?";
        const returnedServer = await db.query(serverCheckSql, [
          req.body[0].server_id,
        ]);
        if (
          returnedServer[0].user_id != req.user.id &&
          !Utils.superAdminCheck(req.user) &&
          returnedServer[0].public_server == 0
        ) {
          res.status(403).json({ message: "User does not own this server." });
          return;
        }
        if (req.body[0].server_id == matchRow[0].server_id) diffServer = true;
      }
      await db.withTransaction(async () => {
        let updateStmt = {
          user_id: req.body[0].user_id,
          start_time: req.body[0].start_time,
          end_time: req.body[0].end_time,
          winner: req.body[0].winner,
          plugin_version: req.body[0].plugin_version,
          forfeit: req.body[0].forfeit,
          cancelled: req.body[0].cancelled,
          team1_score: req.body[0].team1_score,
          team2_score: req.body[0].team2_score,
          private_match: req.body[0].private_match,
          season_id: req.body[0].season_id,
          server_id: req.body[0].server_id,
        };
        // Remove any values that may not be updated.
        updateStmt = await db.buildUpdateStatement(updateStmt);
        if (Object.keys(updateStmt).length === 0) {
          res
            .status(412)
            .json({ message: "No update data has been provided." });
          return;
        }
        let sql = "UPDATE `match` SET ? WHERE id = ?";
        await db.query(sql, [updateStmt, req.body[0].match_id]);
        sql = "INSERT match_spectator (match_id, auth) VALUES (?,?)";
        for (let key in req.body[0].spectator_auths) {
          let newAuth = await Utils.convertToSteam64(key);
          await db.query(sql, [req.body[0].match_id, newAuth]);
        }
      });
      await db.withTransaction(async () => {
        const ourServer = await db.query(ourServerSql, [matchRow[0].server_id]);
        const serverConn = new GameServer(ourServer[0].ip_string, ourServer[0].port, null, ourServer[0].rcon_password);
        if (
          req.body[0].forfeit == 1 ||
          req.body[0].cancelled == 1 ||
          req.body[0].end_time != null
        ) {
          if(serverConn.endGet5Match()){
            sql = "UPDATE game_server SET in_use=0 WHERE id=?";
            await db.query(sql, [matchRow[0].server_id]);
          }
        } else {
          if (!req.body[0].ignore_server) {
            if (diffServer) {
              if(serverConn.endGet5Match()){
                sql = "UPDATE game_server SET in_use=0 WHERE id=?";
                await db.query(sql, [matchRow[0].server_id]);
              }
              const newServeInfo = await db.query(ourServerSql, [req.body[0].server_id]);
              const newServer = new GameServer(newServeInfo[0].ip_string, newServeInfo[0].port, null, newServeInfo[0].rcon_password);
              if(newServer.prepareGet5Match(req.get("Host"), matchRow[0].api_key)){
                sql = "UPDATE game_server SET in_use=1 WHERE id=?";
                await db.query(sql, [req.body[0].server_id]);
                res.json({ message: "Match updated successfully! Please move over the last backup from the old server to the new one!" });
                return;
              }
            }
            
          }
        }
      });
      res.json({ message: "Match updated successfully!" });
    }
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** DEL - Delete all match data associated with a match, including stats, vetoes, etc.
 * @name router.delete('/delete')
 * @memberof module:routes/matches
 * @function
 * @param {number} req.user.id - The ID of the user deleteing. Can check if admin when implemented.
 * @param {number} req.body[0].match_id - The ID of the match to remove all values pertaining to the match.
 *
 */
/**
 * @swagger
 *
 * /matches:
 *   delete:
 *     description: Delete a match and all values associated if it is cancelled.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              match_id:
 *                type: integer
 *                required: true
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/MatchNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let userId = req.user.id;
  let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
  const matchRow = await db.query(matchUserId, req.body[0].match_id);
  if (matchRow.length === 0) {
    res.status(404).json({ message: "No match found." });
    return;
  } else if (
    matchRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction(async () => {
        let matchId = req.body[0].match_id;
        let isMatchCancelled =
          "SELECT cancelled, forfeit, end_time, user_id from `match` WHERE id = ?";
        // First find any matches/mapstats/playerstats associated with the team.
        let playerStatDeleteSql = "DELETE FROM player_stats WHERE match_id = ?";
        let mapStatDeleteSql = "DELETE FROM map_stats WHERE match_id = ?";
        let spectatorDeleteSql =
          "DELETE FROM match_spectator WHERE match_id = ?";
        const matchCancelledResult = await db.query(isMatchCancelled, matchId);
        if (matchCancelledResult.length === 0) {
          res.status(404).json({ message: "No match found." });
          return;
        }
        if (
          matchCancelledResult[0].user_id != userId &&
          !Utils.superAdminCheck(req.user)
        ) {
          res.status(403).json({
            message:
              "You do not have authorized access to delete these matches.",
          });
          return;
        } else if (
          matchCancelledResult[0].cancelled == 1 ||
          matchCancelledResult[0].forfeit == 1 ||
          matchCancelledResult[0].end_time != null
        ) {
          let deleteMatchsql = "DELETE FROM `match` WHERE id = ?";
          await db.query(playerStatDeleteSql, matchId);
          await db.query(mapStatDeleteSql, matchId);
          await db.query(spectatorDeleteSql, matchId);
          const delRows = await db.query(deleteMatchsql, matchId);
          if (delRows.affectedRows > 0)
            res.json({ message: "Match deleted successfully!" });
          else
            res.status(500).json({
              message: "We found an issue deleting the match values.",
            });
          return;
        } else {
          res.status(403).json({
            message: "Cannot delete match as it is not cancelled.",
          });
          return;
        }
      });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
});

// Helper functions
/** Builds the team dictionary.
 * @function
 * @memberof module:routes/matches/
 * @param {Object} team - The team object that is used to built the player dictionary.
 * @param {number} teamNumber - Which team to provide for the match title.
 * @param {Object} matchData - The data that contains the match to get the team string and scores.
 */
async function build_team_dict(team, teamNumber, matchData) {
  let sql = "SELECT auth, name FROM team_auth_names WHERE team_id = ?";
  const playerAuths = await db.query(sql, [team.id]);
  let normalizedAuths = {};
  for (let i = 0; i < playerAuths.length; i++) {
    const key = playerAuths[i].auth;
    if(playerAuths[i].name == '')
      normalizedAuths[key] = null;
    else
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
      teamNumber === 1 ? matchData.team1_string : matchData.team2_string,
  };
  for (let key in teamData) {
    if (teamData[key] === null) delete teamData[key];
  }
  return teamData;
}

module.exports = router;
