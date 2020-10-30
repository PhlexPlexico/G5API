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

const config = require("config");

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
 *           type: string
 *           format: date-time
 *           description: The starting time of the match.
 *         end_time:
 *           type: string
 *           format: date-time
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
 *         onsite_veto:
 *           type: boolean
 *           description: Flag indicating whether you wish to veto on-site, or in-game.
 *         is_pug:
 *           type: boolean
 *           description: Flag that indicates whether teams are required or not and to keep track of stats for pug/non-pug games.
 *         match_cvars:
 *           type: object
 *           description: An object of key-value pairs containing different unique match CVARs.
 *
 *     MatchConfig:
 *        type: object
 *        properties:
 *           matchid:
 *              type: integer
 *              description: Identifier for the match.
 *           match_title:
 *              type: string
 *              description: Title of the match.
 *           side_type:
 *              type: string
 *              description: Idenitifer for how sides are determined.
 *           veto_first:
 *              type: string
 *              description: Whether team1 or team2 gets the first veto.
 *           skip_veto:
 *              type: integer
 *              description: Integer representing a boolean if to skip vetoes or not.
 *           min_players_to_ready:
 *              type: integer
 *              description: The amount of players on a team required to ready up.
 *           players_per_team:
 *              type: integer
 *              description: The amount of players per team.
 *           team1:
 *              $ref: '#/components/schemas/TeamObject'
 *           team2:
 *              $ref: '#/components/schemas/TeamObject'
 *           cvars:
 *            type: object
 *            description: Any additional cvars sent to the server.
 *           spectators:
 *            type: object
 *            description: Key value pair objects containing steamID64 as key, and nicknames as values.
 *           maplist:
 *            type: object
 *            minProperties: 1
 *            maxProperties: 7
 *            description: Key value pair containing an integer representing map order, and value representing map name.
 *           min_spectators_to_ready:
 *            type: integer
 *            description: Value representing specatators to ready up.
 *           maps_to_win:
 *            type: integer
 *            description: The amount of maps required to win a match.
 *
 *     TeamObject:
 *      type: object
 *      properties:
 *        name:
 *          type: string
 *          description: Name of the team.
 *        tag:
 *          type: string
 *          description: Shorthand tag for the team.
 *        players:
 *          type: object
 *          properties:
 *            steamid:
 *              type: string
 *              description: The key is the Steam64 ID.
 *            nickname:
 *              type: string
 *              description: The value is a preferred nickname if present.
 *     MatchData:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The integer ID from the database.
 *         user_id:
 *           type: integer
 *           description: The ID of the user that created the match.
 *         server_id:
 *           type: integer
 *           description: The ID of the selected server to play on the match.
 *         team1_id:
 *           type: integer
 *           description: The ID of team one.
 *         team2_id:
 *           type: integer
 *           description: The ID of team two.
 *         winner:
 *           type: integer
 *           description: The foreign key of a team that won the match.
 *         team1_score:
 *           type: integer
 *           description: The score of team 1.
 *         team2_score:
 *           type: integer
 *           description: The score of team 2.
 *         team1_string:
 *           type: string
 *           description: The current name of team 1 in the match.
 *         team2_string:
 *           type: string
 *           description: The current name of team 2 in the match.
 *         cancelled:
 *           type: boolean
 *           description: Whether a match was cancelled or not.
 *         forfeit:
 *           type: boolean
 *           description: Whether the match was forfeit or not.
 *         start_time:
 *           type: string
 *           format: date-time
 *           description: The starting time of the match.
 *         end_time:
 *           type: string
 *           format: date-time
 *           description: The ending time of the match.
 *         max_maps:
 *           type: integer
 *           description: The number of max maps played per series.
 *         title:
 *           type: string
 *           description: The title of the match, default is 'Map {MAPNUMBER} of {MAXMAPS}'.
 *         skip_veto:
 *           type: boolean
 *           description: Boolean value representing whether to skip the veto or not.
 *         private_match:
 *           type: boolean
 *           description: Boolean value representing whether the match is limited visibility to users on the team or who is on map stats. Defaults to false.
 *         enforce_teams:
 *           type: boolean
 *           description: Boolean value representing whether the server will enforce teams on match start. Defaults to true.
 *         min_player_ready:
 *           type: integer
 *           description: The minimum players required to ready up per team.
 *         season_id:
 *           type: integer
 *           description: The ID of the season. NULL if no season.
 *   responses:
 *     MatchFinished:
 *        description: Match already finished.
 *        content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/SimpleResponse'
 *     NoMatchData:
 *       description: No match data provided.
 *       content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/SimpleResponse'
 *     MatchInvalidData:
 *       description: The match data provided is invalid.
 *       content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/SimpleResponse'
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
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  matches:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql =
      "SELECT id, user_id, server_id, team1_id, team2_id, winner, team1_score, team2_score, team1_series_score, team2_series_score, team1_string, team2_string, cancelled, forfeit, start_time, end_time, max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, season_id, is_pug FROM `match` WHERE cancelled = 0";
    const matches = await db.query(sql);
    if (matches.length === 0) {
      res.status(404).json({ message: "No matches found." });
      return;
    }
    res.json({ matches });
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
 *                type: object
 *                properties:
 *                  type: array
 *                  matches:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MatchData'
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
    res.json({ matches });
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
 *         schema:
 *          type: integer
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match info
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  match:
 *                    $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
      req.user !== undefined &&
      (matchRow[0].user_id == req.user.id || Utils.superAdminCheck(req.user))
    ) {
      sql = "SELECT * FROM `match` where id=?";
    } else {
      sql =
        "SELECT id, user_id, server_id, team1_id, team2_id, winner, team1_score, team2_score, team1_series_score, team2_series_score, team1_string, team2_string, cancelled, forfeit, start_time, end_time, max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, season_id, is_pug FROM `match` where id = ?";
    }
    matchID = req.params.match_id;
    const matches = await db.query(sql, matchID);
    if (matches.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    }
    const match = JSON.parse(JSON.stringify(matches[0]));
    res.json({ match });
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
 *         schema:
 *          type: integer
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match info
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  matches:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/limit/:limiter", async (req, res, next) => {
  try {
    let lim = parseInt(req.params.limiter);
    let sql = "SELECT * FROM `match` ORDER BY end_time DESC LIMIT ?";
    const matches = await db.query(sql, lim);
    res.json({ matches });
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
 *         schema:
 *            type: integer
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id/config", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM `match` WHERE id = ?";
    let matchID = req.params.match_id;
    let matchCvars;
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
      skip_veto: matchInfo[0].skip_veto == 0 ? false : true,
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
        get5_web_api_url: config.get("server.clientHome") + "/api/",
        get5_check_auths: matchInfo[0].enforce_teams,
      },
      spectators: {},
      maplist:
        matchInfo[0].veto_mappool !== null
          ? matchInfo[0].veto_mappool.replace(/[,]+/g, "").split(" ")
          : null,
      min_spectators_to_ready: 0,
    };
    if (matchInfo[0].max_maps === 2) {
      matchJSON.bo2_series = true;
    } else {
      matchJSON.maps_to_win = parseInt(matchInfo[0].max_maps / 2 + 1);
    }
    // Fill out team data only if we are not PUGging.
    if (matchInfo[0].is_pug == 0 || matchInfo[0].is_pug == null) {
      sql = "SELECT * FROM team WHERE id = ?";
      const team1Data = await db.query(sql, [matchInfo[0].team1_id]);
      const team2Data = await db.query(sql, [matchInfo[0].team2_id]);
      matchJSON.team1 = await build_team_dict(team1Data[0], 1, matchInfo[0]);
      matchJSON.team2 = await build_team_dict(team2Data[0], 2, matchInfo[0]);
    }
    sql = "SELECT * FROM match_cvar WHERE match_id = ?";
    matchCvars = await db.query(sql, matchID);
    matchCvars.forEach((row) => {
      matchJSON.cvars[row.cvar_name] = row.cvar_value;
    });
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
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/NewMatch'
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Create successful
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let newSingle = await db.getConnection();
    // Check if server available, if we are given a server.
    let serverSql =
      "SELECT in_use, user_id, public_server FROM game_server WHERE id = ?";
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
    let teamNameSql = "SELECT name FROM team WHERE id = ?";
    let teamOneName = await db.query(teamNameSql, [req.body[0].team1_id]);
    let teamTwoName = await db.query(teamNameSql, [req.body[0].team2_id]);
    let apiKey = randString.generate({
      length: 24,
      capitalization: "uppercase",
    });
    let matchSpecAuths = [];
    if (req.body[0].spectator_auths != null)
      req.body[0].spectator_auths.forEach(async (auth) => {
        matchSpecAuths.push(Utils.getSteamPID(auth));
      });
    // Almost same behaviour. If we don't indicate pug or enforce teams,
    // enforce by default. Otherwise. do some checks to see if the teams
    // should be enforced. By default, we wish to enforce teams.
    let enfTeam = 1;
    if (req.body[0].enforce_teams == null && req.body[0].is_pug == null) {
      enfTeam = 1;
    } else if (req.body[0].enforce_teams == null && req.body[0].is_pug == 1) {
      enfTeam = 0;
    } else if (req.body[0].enforce_teams == 1) {
      enfTeam = 1;
    } else if (req.body[0].enforce_teams == 0) {
      enfTeam = 0;
    } else if (
      req.body[0].enforce_teams == null &&
      (req.body[0].is_pug == null || req.body[0].is_pug == 0)
    ) {
      enfTeam = 1;
    }
    let skipVeto =
      req.body[0].skip_veto == null ? false : req.body[0].skip_veto;
    await db.withNewTransaction(newSingle, async () => {
      let insertSet = {
        user_id: req.user.id,
        server_id: req.body[0].server_id,
        team1_id: req.body[0].team1_id,
        team2_id: req.body[0].team2_id,
        season_id: req.body[0].season_id,
        start_time: req.body[0].start_time,
        max_maps: req.body[0].max_maps,
        title: req.body[0].title,
        skip_veto: skipVeto,
        veto_first: req.body[0].veto_first,
        veto_mappool: req.body[0].veto_mappool,
        side_type:
          req.body[0].side_type == null ? "standard" : req.body[0].side_type,
        plugin_version: req.body[0].plugin_version,
        private_match:
          req.body[0].private_match == null ? 0 : req.body[0].private_match,
        enforce_teams: enfTeam,
        api_key: apiKey,
        winner: null,
        team1_string: teamOneName[0].name == null ? null : teamOneName[0].name,
        team2_string: teamTwoName[0].name == null ? null : teamTwoName[0].name,
        is_pug: req.body[0].is_pug,
      };
      let sql = "INSERT INTO `match` SET ?";
      let cvarSql =
        "INSERT match_cvar (match_id, cvar_name, cvar_value) VALUES (?,?,?)";
      insertSet = await db.buildUpdateStatement(insertSet);
      let insertMatch = await newSingle.query(sql, [insertSet]);
      sql = "INSERT match_spectator (match_id, auth) VALUES (?,?)";
      for (let key in matchSpecAuths) {
        await newSingle.query(sql, [req.body[0].match_id, key]);
      }
      if (!req.body[0].ignore_server) {
        let ourServerSql =
          "SELECT rcon_password, ip_string, port FROM game_server WHERE id=?";
        const serveInfo = await newSingle.query(ourServerSql, [req.body[0].server_id]);
        const newServer = new GameServer(
          serveInfo[0][0].ip_string,
          serveInfo[0][0].port,
          null,
          serveInfo[0][0].rcon_password
        );
        if (
          (await newServer.isServerAlive()) &&
          (await newServer.isGet5Available())
        ) {
          if (
            !(await newServer.prepareGet5Match(
              config.get("server.apiURL") + "/matches/" + insertMatch[0].insertId + "/config",
              apiKey
            ))
          ) {
            throw "Please check server logs, as something was not set properly. You may cancel the match and server status is not updated.";
          }
        }
      }
      if (req.body[0].match_cvars != null) {
        await db.withNewTransaction(newSingle, async () => {
          let cvarInsertSet = req.body[0].match_cvars;
          for (let key in cvarInsertSet) {
            await newSingle.query(cvarSql, [
              insertMatch[0].insertId,
              key,
              cvarInsertSet[key],
            ]);
          }
        });
      }
      if (req.body[0].server_id) {
        await db.withNewTransaction(newSingle, async () => {
          sql = "UPDATE game_server SET in_use = 1 WHERE id = ?";
          await newSingle.query(sql, [req.body[0].server_id]);
        });
      }
      res.json({
        message: "Match inserted successfully!",
        id: insertMatch[0].insertId,
      });
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
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/NewMatch'
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
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoMatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let newSingle = await db.getConnection();
    let diffServer = false;
    let vetoList = null;
    let ourServerSql =
      "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
    if (req.body[0].match_id == null) {
      res.status(404).json({ message: "Match ID Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT id, user_id, server_id, cancelled, forfeit, end_time, api_key, veto_mappool, max_maps, skip_veto, is_pug FROM `match` WHERE id = ?";
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
      await db.withNewTransaction(newSingle, async () => {
        let vetoSql =
          "SELECT map FROM veto WHERE match_id = ? AND pick_or_veto = 'pick'";
        let vetoMapPool = null;
        let maxMaps = null;
        vetoList = JSON.parse(
          JSON.stringify(await db.query(vetoSql, req.body[0].match_id))
        );
        if (Object.keys(vetoList).length > 0) {
          vetoList.forEach((veto) => {
            vetoMapPool = vetoMapPool.concat(veto.map + ", ");
          });
          maxMaps = Object.keys(vetoList).length;
          // Remove last two characters.
          vetoMapPool = vetoMapPool.substring(0, vetoMapPool.length - 2);
          //If we're identical to the matches map pool, it usually means we've begun.
          if (vetoMapPool == matchRow[0].veto_mappool) {
            vetoMapPool = null;
            maxMaps = null;
          }
        }
        let updateStmt = {
          user_id: req.body[0].user_id,
          server_id: req.body[0].server_id,
          season_id: req.body[0].season_id,
          start_time: req.body[0].start_time,
          end_time: req.body[0].end_time,
          winner: req.body[0].winner,
          plugin_version: req.body[0].plugin_version,
          forfeit: req.body[0].forfeit,
          cancelled: req.body[0].cancelled,
          team1_score: req.body[0].team1_score,
          team2_score: req.body[0].team2_score,
          private_match: req.body[0].private_match,
          max_maps: maxMaps,
          skip_veto: vetoMapPool == null ? null : 1,
          veto_first: req.body[0].veto_first,
          veto_mappool:
            vetoMapPool == null ? req.body[0].veto_mappool : vetoMapPool,
          side_type: req.body[0].side_type,
          enforce_teams:
            matchRow[0].is_pug != null && matchRow[0].is_pug == 1
              ? 0
              : req.body[0].enforce_teams, // Do not update these unless required.
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
        await newSingle.query(sql, [updateStmt, req.body[0].match_id]);
        sql = "INSERT match_spectator (match_id, auth) VALUES (?,?)";
        for (let key in req.body[0].spectator_auths) {
          let newAuth = await Utils.convertToSteam64(key);
          await newSingle.query(sql, [req.body[0].match_id, newAuth]);
        }
      });
      await db.withNewTransaction(newSingle, async () => {
        const ourServer = await db.query(ourServerSql, [matchRow[0].server_id]);
        const serverConn = new GameServer(
          ourServer[0].ip_string,
          ourServer[0].port,
          null,
          ourServer[0].rcon_password
        );
        if (
          req.body[0].forfeit == 1 ||
          req.body[0].cancelled == 1 ||
          req.body[0].end_time != null
        ) {
          if (serverConn.endGet5Match()) {
            sql = "UPDATE game_server SET in_use=0 WHERE id=?";
            await newSingle.query(sql, [matchRow[0].server_id]);
          }
        } else {
          if (!req.body[0].ignore_server) {
            if (diffServer) {
              if (serverConn.endGet5Match()) {
                sql = "UPDATE game_server SET in_use=0 WHERE id=?";
                await newSingle.query(sql, [matchRow[0].server_id]);
              }
              const newServeInfo = await db.query(ourServerSql, [
                req.body[0].server_id,
              ]);
              const newServer = new GameServer(
                newServeInfo[0].ip_string,
                newServeInfo[0].port,
                null,
                newServeInfo[0].rcon_password
              );
              if (
                newServer.prepareGet5Match(
                  config.get("server.apiURL") + "/matches/" + matchRow[0].id + "/config",
                  matchRow[0].api_key
                )
              ) {
                sql = "UPDATE game_server SET in_use=1 WHERE id=?";
                await newSingle.query(sql, [req.body[0].server_id]);
                res.json({
                  message:
                    "Match updated successfully! Please move over the last backup from the old server to the new one!",
                });
                return;
              }
            }
          }
        }
      });
      if (req.body[0].match_cvars != null) {
        await db.withNewTransaction(newSingle, async () => {
          let newCvars = req.body[0].match_cvars;
          sql =
            "INSERT match_cvar (match_id, cvar_name, cvar_value) VALUES (?,?,?)";
          for (let key in newCvars) {
            await newSingle.query(sql, [req.body[0].match_id, key, newCvars[key]]);
          }
        });
      }
      res.json({ message: "Match updated successfully!" });
    }
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

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
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let newSingle = await db.getConnection();
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
      await db.withNewTransaction(newSingle, async () => {
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
          await newSingle.query(playerStatDeleteSql, matchId);
          await newSingle.query(mapStatDeleteSql, matchId);
          await newSingle.query(spectatorDeleteSql, matchId);
          const delRows = await newSingle.query(deleteMatchsql, matchId);
          if (delRows[0].affectedRows > 0)
            res.json({ message: "Match deleted successfully!" });
          else
            throw "We found an issue deleting the match values.";
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
    if (playerAuths[i].name == "") normalizedAuths[key] = null;
    else normalizedAuths[key] = playerAuths[i].name;
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
      matchData.max_maps == 1
        ? teamNumber === 1
          ? matchData.team1_string
          : matchData.team2_string
        : null,
  };
  for (let key in teamData) {
    if (teamData[key] === null) delete teamData[key];
  }
  return teamData;
}

module.exports = router;
