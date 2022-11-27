/** Express API router for matches in get5.
 * @module routes/matches/matches
 * @requires express
 * @requires db
 */
import { Router } from "express";

const router = Router();

import db from "../../db.js";

import { generate } from "randomstring";

import Utils from "../../utility/utils.js";

import GameServer from "../../utility/serverrcon.js";

import config from "config";

import GlobalEmitter from "../../utility/emitter.js";

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
 *           map_sides:
 *            type: string
 *            description: Determines the starting sides for each map. If this array is shorter than num_maps, side_type will determine the side-behavior of the remaining maps. Ignored if skip_veto is false.
 * 
 *     MatchPauseObject:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: The internal database primary key for match pausing.
 *        match_id:
 *          type: integer
 *          description: Foreign key to match table.
 *        pause_type:
 *          type: string
 *          description: The type of pause last called.
 *        team_paused:
 *          type: string
 *          description: The team which last called a pause.
 *        paused:
 *          type: boolean
 *          description: Whether the match is currently paused or not with the given previous values.
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
 *     parameters:
 *       - in: query
 *         name: asc
 *         description: Whether to have values in descending order. Defaults to true.
 *         required: false
 *         schema:
 *          type: boolean
 *          default: true
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let isAscending = req.query?.asc == null ? false : req.query.asc;
    let sql = 
      "SELECT mtch.id, mtch.user_id, mtch.server_id, mtch.team1_id, mtch.team2_id, mtch.winner, mtch.team1_score, " +
      "mtch.team2_score, mtch.team1_series_score, mtch.team2_series_score, mtch.team1_string, mtch.team2_string, " +
      "mtch.cancelled, mtch.forfeit, mtch.start_time, mtch.end_time, mtch.max_maps, mtch.title, mtch.skip_veto, mtch.private_match, " +
      "mtch.enforce_teams, mtch.min_player_ready, mtch.season_id, mtch.is_pug, usr.name as owner, mp.team1_score as team1_mapscore, mp.team2_score as team2_mapscore " +
      "FROM `match` mtch JOIN user usr ON mtch.user_id = usr.id LEFT JOIN map_stats mp ON mp.match_id = mtch.id " +
      "WHERE cancelled = 0 " +
      "OR cancelled IS NULL " +
      "GROUP BY mtch.id " +
      "ORDER BY id DESC";
    const matches = await db.query(sql);
    if (!matches.length) {
      res.status(404).json({ message: "No matches found." });
      return;
    }
    if (isAscending) {
      res.json({ matches: matches.reverse() });
    } else {
      res.json({ matches });
    }
  } catch (err) {
    console.error(err);
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
 *     parameters:
 *       - in: query
 *         name: asc
 *         description: Whether to have values in descending order. Defaults to true.
 *         required: false
 *         schema:
 *          type: boolean
 *          default: true
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Matches of logged in user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/MatchesNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/mymatches", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let isAscending = req.query?.asc == null ? false : req.query.asc;
    /*let sql = "SELECT mtch.*, usr.name as owner FROM `match` mtch " + 
              "JOIN user usr ON mtch.user_id = usr.id " +
              "WHERE user_id = ? ORDER BY id DESC";*/
      let sql = "SELECT mtch.id, mtch.user_id, mtch.server_id, mtch.team1_id, mtch.team2_id, mtch.winner, mtch.team1_score, " +
      "mtch.team2_score, mtch.team1_series_score, mtch.team2_series_score, mtch.team1_string, mtch.team2_string, " +
      "mtch.cancelled, mtch.forfeit, mtch.start_time, mtch.end_time, mtch.max_maps, mtch.title, mtch.skip_veto, mtch.private_match, " +
      "mtch.enforce_teams, mtch.min_player_ready, mtch.season_id, mtch.is_pug, usr.name as owner, mp.team1_score as team1_mapscore, mp.team2_score as team2_mapscore " +
      "FROM `match` mtch JOIN user usr ON mtch.user_id = usr.id LEFT JOIN map_stats mp ON mp.match_id = mtch.id " +
      "WHERE mtch.user_id = ? " +
      "OR cancelled IS NULL " +
      "GROUP BY mtch.id " +
      "ORDER BY id DESC";
    const matches = await db.query(sql, [req.user.id]);
    if (!matches.length) {
      res.status(404).json({ message: "No matches found." });
      return;
    }
    if (isAscending) {
      res.json({ matches: matches.reverse() });
    } else {
      res.json({ matches });
    }
    
  } catch (err) {
    console.error(err);
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
    if (!matchRow.length) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      req.user !== undefined &&
      (matchRow[0].user_id == req.user.id || Utils.superAdminCheck(req.user))
    ) {
      sql = "SELECT * FROM `match` where id=?";
    } else {
      sql =
        "SELECT id, user_id, server_id, team1_id, team2_id, winner, " +
        "team1_score, team2_score, team1_series_score, team2_series_score, " +
        "team1_string, team2_string, cancelled, forfeit, start_time, end_time, " +
        "max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, " +
        "season_id, is_pug, map_sides FROM `match` where id = ?";
    }
    let matchID = req.params.match_id;
    const matches = await db.query(sql, matchID);
    if (!matches.length) {
      res.status(404).json({ message: "No match found." });
      return;
    }
    const match = JSON.parse(JSON.stringify(matches[0]));
    res.json({ match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches/:match_id/stream:
 *   get:
 *     description: Returns an event stream of a specified matches info.
 *     produces:
 *       - text/event-stream
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
 router.get("/:match_id/stream", async (req, res, next) => {
  try {
    let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
    let sql;
    const matchRow = await db.query(matchUserId, req.params.match_id);
    if (!matchRow.length) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      req.user !== undefined &&
      (matchRow[0].user_id == req.user.id || Utils.superAdminCheck(req.user))
    ) {
      sql = "SELECT * FROM `match` where id=?";
    } else {
      sql =
        "SELECT id, user_id, server_id, team1_id, team2_id, winner, " +
        "team1_score, team2_score, team1_series_score, team2_series_score, " +
        "team1_string, team2_string, cancelled, forfeit, start_time, end_time, " +
        "max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, " +
        "season_id, is_pug, map_sides FROM `match` where id = ?";
    }

    let matchID = req.params.match_id;
    let matches = await db.query(sql, matchID);

    res.set({
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    matches = matches.map(v => Object.assign({}, v));
    let matchString = `event: matches\ndata:${JSON.stringify(matches[0])}\n\n`
    // Need to name the function in order to remove it!
    const matchStreamStatus = async () => {
      matches = await db.query(sql, matchID);
      matches = matches.map(v => Object.assign({}, v));
      matches = `event: matches\ndata: ${JSON.stringify(matches[0])}\n\n`
      res.write(matchString);
    };

    GlobalEmitter.on("matchUpdate", matchStreamStatus);
    res.write(matchString);

    req.on("close", () => {
      GlobalEmitter.removeListener("matchUpdate", matchStreamStatus);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("matchUpdate", matchStreamStatus);
      res.end();
    });

  } catch (err) {
    console.error(err.toString());
    res.status(500).write(`event: error\ndata: ${err.toString()}\n\n`)
    res.end();
  }
});

/**
 * @swagger
 *
 * /matches/:match_id/paused/stream:
 *   get:
 *     description: Get the pause information on a match streamed as a server sent event.
 *     produces:
 *       - text/event-stream
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Returns information based on a match if it is paused.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchPauseObject'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:match_id/paused/stream", async (req, res, next) => {
  try {
    let matchId = req.params.match_id;
    let sql =
      "SELECT id, match_id, pause_type, team_paused, paused " +
      "FROM `match_pause` " +
      "WHERE match_id = ? ";
    let matchPauseInfo = await db.query(sql, matchId);

    res.set({
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    matchPauseInfo = matchPauseInfo.map(v => Object.assign({}, v));
    let matchPauseString = `event: matches\ndata:${JSON.stringify(matchPauseInfo)}`
    // Need to name the function in order to remove it!
    const matchPauseStreamStatus = async () => {
      matchPauseInfo = await db.query(sql, matchId);
      matchPauseInfo = matchPauseInfo.map(v => Object.assign({}, v));
      matchPauseInfo = `event: matches\ndata: ${JSON.stringify(matchPauseString)}\n\n`
      res.write(matchPauseString);
    };

    GlobalEmitter.on("matchUpdate", matchPauseStreamStatus);
    res.write(matchPauseString);

    req.on("close", () => {
      GlobalEmitter.removeListener("matchUpdate", matchPauseStreamStatus);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("matchUpdate", matchPauseStreamStatus);
      res.end();
    });

  } catch (err) {
    console.error(err.toString());
    res.status(500).write(`event: error\ndata: ${err.toString()}\n\n`)
    res.end();
  }
});

/**
 * @swagger
 *
 * /matches/:match_id/paused:
 *   get:
 *     description: Get the pause information on a match.
 *     produces:
 *       - application/json
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Returns information based on a match if it is paused.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchPauseObject'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:match_id/paused", async (req, res, next) => {
  try {
    let sql =
      "SELECT id, match_id, pause_type, team_paused, paused " +
      "FROM `match_pause` " +
      "WHERE match_id = ? ";
    const matchPauseInfo = await db.query(sql, req.body[0].match_id);
    if (!matchPauseInfo.length) {
      res.status(404).json({ message: "No match pause info found." });
      return;
    }
    res.json({ matchPauseInfo });
  } catch (err) {
    console.error(err);
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
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/limit/:limiter", async (req, res, next) => {
  try {
    let lim = parseInt(req.params.limiter);
    let sql;
    if (req.user !== undefined && Utils.superAdminCheck(req.user)) {
      sql =
        "SELECT * FROM `match` WHERE cancelled = 0 OR cancelled IS NULL ORDER BY end_time DESC LIMIT ?";
    } else {
      sql =
        "SELECT id, user_id, server_id, team1_id, team2_id, winner, " +
        "team1_score, team2_score, team1_series_score, team2_series_score, " +
        "team1_string, team2_string, cancelled, forfeit, start_time, end_time, " +
        "max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, " +
        "season_id, is_pug, map_sides FROM `match` WHERE cancelled = 0 " + 
        "OR cancelled IS NULL ORDER BY end_time DESC LIMIT ?";
    }
    const matches = await db.query(sql, lim);
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /matches/limit/:firstvalue&:lastvalue:
 *   get:
 *     description: Returns a subset of matches between a range.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: firstvalue
 *         required: true
 *         schema:
 *          type: integer
 *       - name: lastvalue
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
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/page/:firstvalue&:lastvalue", async (req, res, next) => {
  try {
    let firstVal = parseInt(req.params.firstvalue);
    let secondVal = parseInt(req.params.lastvalue);
    let sql;
    if (req.user !== undefined && Utils.superAdminCheck(req.user)) {
      sql =
        "SELECT * FROM `match` WHERE cancelled = 0 OR cancelled IS NULL ORDER BY id DESC LIMIT ?,?";
    } else {
      sql =
        "SELECT id, user_id, server_id, team1_id, team2_id, winner, " +
        "team1_score, team2_score, team1_series_score, team2_series_score, " +
        "team1_string, team2_string, cancelled, forfeit, start_time, end_time, " +
        "max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, " +
        "season_id, is_pug, map_sides FROM `match` WHERE cancelled = 0 " +
        "OR cancelled IS NULL ORDER BY id DESC LIMIT ?,?";
    }
    const matches = await db.query(sql, [firstVal, secondVal]);
    res.json({ matches });
  } catch (err) {
    console.error(err);
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
    let matchSpecs;
    const matchInfo = await db.query(sql, [matchID]);
    if (!matchInfo.length) {
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
        matchInfo[0].players_per_team !== null
          ? matchInfo[0].players_per_team
          : 5,
      team1: {},
      team2: {},
      cvars: {
        get5_web_api_url: config.get("server.apiURL"),
        get5_check_auths: matchInfo[0].enforce_teams.toString(),
      },
      spectators: {
        players: [],
      },
      maplist:
        matchInfo[0].veto_mappool !== null
          ? matchInfo[0].veto_mappool.replace(/[,]+/g, "").split(" ")
          : null,
      min_spectators_to_ready:
        matchInfo[0].min_spectators_to_ready !== null
          ? matchInfo[0].min_spectators_to_ready
          : 0,
    };
    matchJSON.num_maps = parseInt(matchInfo[0].max_maps);
    if (matchJSON.skip_veto && matchInfo[0].map_sides)
      matchJSON.map_sides = matchInfo[0].map_sides.split(",");
    sql = "SELECT * FROM team WHERE id = ?";
    const team1Data = await db.query(sql, [matchInfo[0].team1_id]);
    const team2Data = await db.query(sql, [matchInfo[0].team2_id]);

    matchJSON.team1 = JSON.parse(
      await build_team_dict(team1Data[0], 1, matchInfo[0])
    );
    matchJSON.team2 = JSON.parse(
      await build_team_dict(team2Data[0], 2, matchInfo[0])
    );
    sql = "SELECT * FROM match_cvar WHERE match_id = ?";
    matchCvars = await db.query(sql, matchID);
    //XXX: Possibly breaking JSON with quotes only?
    matchCvars.forEach((row) => {
      matchJSON.cvars[row.cvar_name] = row.cvar_value;
    });
    sql = "SELECT * FROM match_spectator WHERE match_id=?";
    matchSpecs = await db.query(sql, matchID);
    let newSpecs = {};
    matchSpecs.forEach((row) => {
      newSpecs[row.auth] = row.spectator_name == null ? "" : row.spectator_name;
    });
    if (Object.keys(newSpecs).length > 0) matchJSON.spectators.players = newSpecs;
    res.json(matchJSON);
  } catch (err) {
    console.error(err);
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
    // Check if server available, if we are given a server.
    let serverSql =
      "SELECT in_use, user_id, public_server FROM game_server WHERE id = ?";
    if (req.body[0].server_id != null) {
      const serverInUse = await db.query(serverSql, [
        req.body[0].server_id,
      ]);
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
    let teamOneName = await db.query(teamNameSql, [
      req.body[0].team1_id,
    ]);
    let teamTwoName = await db.query(teamNameSql, [
      req.body[0].team2_id,
    ]);
    let apiKey = generate({
      length: 24,
      capitalization: "uppercase",
    });
    let skipVeto =
      req.body[0].skip_veto == null ? false : req.body[0].skip_veto;
    let insertMatch;
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
      enforce_teams:
        req.body[0].enforce_teams == null ? 1 : req.body[0].enforce_teams,
      api_key: apiKey,
      winner: null,
      team1_string:
        teamOneName[0].name == null ? null : teamOneName[0].name,
      team2_string:
        teamTwoName[0].name == null ? null : teamTwoName[0].name,
      is_pug: req.body[0].is_pug,
      min_player_ready: req.body[0].min_players_to_ready,
      players_per_team: req.body[0].players_per_team,
      min_spectators_to_ready:
        req.body[0].min_spectators_to_ready !== null
          ? req.body[0].min_spectators_to_ready
          : 0,
      map_sides: req.body[0].map_sides !== null
          ? req.body[0].map_sides
          : null
    };
    let sql = "INSERT INTO `match` SET ?";
    let cvarSql =
      "INSERT match_cvar (match_id, cvar_name, cvar_value) VALUES (?,?,?)";
    insertSet = await db.buildUpdateStatement(insertSet);
    insertMatch = await db.query(sql, [insertSet]);
    if (req.body[0].spectator_auths) {
      sql = "INSERT match_spectator (match_id, auth, spectator_name) VALUES (?,?,?)";
      for (let key in req.body[0].spectator_auths) {
        let newAuth = await Utils.getSteamPID(req.body[0].spectator_auths[key].split(";")[0]);
        await db.query(sql, [
          insertMatch.insertId,
          newAuth,
          req.body[0].spectator_auths[key].split(";")[1]
        ]);
      }
    }

    if (req.body[0].match_cvars != null) {
      let cvarInsertSet = req.body[0].match_cvars;
      for (let key in cvarInsertSet) {
        await db.query(cvarSql, [
          insertMatch.insertId,
          key.replace(/"/g, '\\"'),
          typeof cvarInsertSet[key] === 'string' ? cvarInsertSet[key].replace(/"/g, '\\"') : cvarInsertSet[key]
        ]);
      }
    }
    if (!req.body[0].ignore_server) {
      let ourServerSql =
        "SELECT rcon_password, ip_string, port FROM game_server WHERE id=?";
      const serveInfo = await db.query(ourServerSql, [
        req.body[0].server_id,
      ]);
      const newServer = new GameServer(
        serveInfo[0].ip_string,
        serveInfo[0].port,
        serveInfo[0].rcon_password
      );
      if (
        (await newServer.isServerAlive()) &&
        (await newServer.isGet5Available())
      ) {
        if (
          !(await newServer.prepareGet5Match(
            config.get("server.apiURL") +
            "/matches/" +
            insertMatch.insertId +
            "/config",
            apiKey
          ))
        ) {
          throw "Please check server logs, as something was not set properly. You may cancel the match and server status is not updated.";
        }
      }
    }
    if (req.body[0].server_id) {
      sql = "UPDATE game_server SET in_use = 1 WHERE id = ?";
      await db.query(sql, [req.body[0].server_id]);
    }
    res.json({
      message: "Match inserted successfully!",
      id: insertMatch.insertId,
    });
  } catch (err) {
    console.error(err);
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
    let diffServer = false;
    let vetoList = null;
    let ourServerSql =
      "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
    let message = "Match updated successfully!";
    let errMessage = await Utils.getUserMatchAccess(
      req.body[0].match_id,
      req.user
    );
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      let currentMatchInfo =
        "SELECT id, user_id, server_id, cancelled, forfeit, end_time, api_key, veto_mappool, max_maps, skip_veto, is_pug FROM `match` WHERE id = ?";
      const matchRow = await db.query(
        currentMatchInfo,
        req.body[0].match_id
      );
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
        if (req.body[0].server_id != matchRow[0].server_id)
          diffServer = true;
      }

      let vetoSql =
        "SELECT map FROM veto WHERE match_id = ? AND pick_or_veto = 'pick'";
      let vetoMapPool = null;
      let maxMaps = null;
      vetoList = await db.query(vetoSql, req.body[0].match_id);
      vetoList = JSON.parse(JSON.stringify(vetoList));
      if (Object.keys(vetoList).length > 0) {
        vetoList.forEach((veto) => {
          //console.log(veto);
          if (vetoMapPool == null) vetoMapPool = veto.map;
          else vetoMapPool = vetoMapPool + " " + veto.map;
        });
        maxMaps = Object.keys(vetoList).length;
        // Remove last two characters.
        // vetoMapPool = vetoMapPool.substring(0, vetoMapPool.length - 2);
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
        players_per_team:
          req.body[0].players_per_team == null ? null : players_per_team,
        min_spectators_to_ready:
          req.body[0].min_spectators_to_ready !== null
            ? req.body[0].min_spectators_to_ready
            : 0,
        map_sides: req.body[0].map_sides !== null
        ? req.body[0].map_sides
        : null
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);
      if (!Object.keys(updateStmt)) {
        res
          .status(412)
          .json({ message: "No update data has been provided." });
        return;
      }
      let sql = "UPDATE `match` SET ? WHERE id = ?";
      await db.query(sql, [updateStmt, req.body[0].match_id]);
      if (req.body[0].spectator_auths) {
        sql = "INSERT match_spectator (match_id, auth, spectator_name) VALUES (?,?,?)";
        for (let key in req.body[0].spectator_auths) {
          let newAuth = await Utils.getSteamPID(req.body[0].spectator_auths[key].split(";")[0]);
          await db.query(sql, [
            insertMatch.insertId,
            newAuth,
            req.body[0].spectator_auths[key].split(";")[1]
          ]);
        }
      }
      const ourServer = await db.query(ourServerSql, [
        matchRow[0].server_id,
      ]);
      const serverConn =
        matchRow[0].server_id != null
          ? new GameServer(
            ourServer[0].ip_string,
            ourServer[0].port,
            ourServer[0].rcon_password
          )
          : null;
      if (
        req.body[0].forfeit == 1 ||
        req.body[0].cancelled == 1 ||
        req.body[0].end_time != null
      ) {
        if (serverConn != null && serverConn.endGet5Match()) {
          sql = "UPDATE game_server SET in_use=0 WHERE id=?";
          await db.query(sql, [matchRow[0].server_id]);
        }
        if (matchRow[0].is_pug != null && matchRow[0].is_pug == 1) {
          let pugSql =
            "DELETE FROM team_auth_names WHERE team_id = ? OR team_id = ?";
          await db.query(pugSql, [
            matchRow[0].team1_id,
            matchRow[0].team2_id,
          ]);
          pugSql = "DELETE FROM team WHERE id = ? OR id = ?";
          await db.query(pugSql, [
            matchRow[0].team1_id,
            matchRow[0].team2_id,
          ]);
        }
      } else {
        if (!req.body[0].ignore_server) {
          if (diffServer) {
            if (serverConn != null && serverConn.endGet5Match()) {
              sql = "UPDATE game_server SET in_use=0 WHERE id=?";
              await db.query(sql, [matchRow[0].server_id]);
            }
            const newServeInfo = await db.query(ourServerSql, [
              req.body[0].server_id,
            ]);
            const newServer = new GameServer(
              newServeInfo[0].ip_string,
              newServeInfo[0].port,
              newServeInfo[0].rcon_password
            );
            if (
              await newServer.prepareGet5Match(
                config.get("server.apiURL") +
                "/matches/" +
                matchRow[0].id +
                "/config",
                matchRow[0].api_key
              )
            ) {
              sql = "UPDATE game_server SET in_use=1 WHERE id=?";
              await db.query(sql, [req.body[0].server_id]);
              message =
                "Match updated successfully! Please move over the last backup from the old server to the new one!";
            }
          }
        }
      }
      if (req.body[0].match_cvars != null) {
        let newCvars = req.body[0].match_cvars;
        sql =
          "INSERT match_cvar (match_id, cvar_name, cvar_value) VALUES (?,?,?)";
        for (let key in newCvars) {
          await db.query(sql, [
            req.body[0].match_id,
            key,
            newCvars[key],
          ]);
        }
      }
      res.json({ message: message });
      return;
    }
  } catch (err) {
    res.status(500).json({ message: err.toString() });
    console.error(err);
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
 *              all_cancelled:
 *                type: boolean
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
  let userId = req.user.id;
  if (req.body[0].all_cancelled == false || req.body[0].all_cancelled == null) {
    let errMessage = await Utils.getUserMatchAccessNoFinalize(
      req.body[0].match_id,
      req.user
    );
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      try {
        let matchId = req.body[0].match_id;
        let isMatchCancelled =
          "SELECT cancelled, forfeit, end_time, user_id from `match` WHERE id = ?";
        // First find any matches/mapstats/playerstats associated with the team.
        let playerStatDeleteSql =
          "DELETE FROM player_stats WHERE match_id = ?";
        let mapStatDeleteSql = "DELETE FROM map_stats WHERE match_id = ?";
        let spectatorDeleteSql =
          "DELETE FROM match_spectator WHERE match_id = ?";
        const matchCancelledResult = await db.query(
          isMatchCancelled,
          matchId
        );
        if (
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
          else throw "We found an issue deleting the match values.";
          return;
        } else {
          res.status(403).json({
            message: "Cannot delete match as it is not cancelled.",
          });
          return;
        }
      } catch (err) {
        res.status(500).json({ message: err.toString() });
      }
    }
  } else if (req.body[0].all_cancelled == true) {
    try {
      let deleteCancelledStats =
        "DELETE FROM player_stats WHERE match_id IN (SELECT id FROM `match` WHERE cancelled = 1 AND user_id = ?)";
      let deleteCancelledMapStats =
        "DELETE FROM map_stats WHERE match_id IN (SELECT id FROM `match` WHERE cancelled = 1 AND user_id = ?)";
      let deleteCancelledSpecs =
        "DELETE FROM match_spectator WHERE match_id IN (SELECT id FROM `match` WHERE cancelled = 1 AND user_id = ?)";
      let deleteMatch =
        "DELETE FROM `match` WHERE cancelled = 1 AND user_id = ?";
      await db.query(deleteCancelledStats, [userId]);
      await db.query(deleteCancelledMapStats, [userId]);
      await db.query(deleteCancelledSpecs, [userId]);
      const delRows = await db.query(deleteMatch, [userId]);
      if (delRows.affectedRows > 0)
        res.json({ message: "Matches deleted successfully!" });
      else res.json({ message: "No cancelled matches to delete." });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: err.toString() });
      return;
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
  let sql = "SELECT auth, name, coach FROM team_auth_names WHERE team_id = ? ORDER BY captain DESC";
  const playerAuths = await db.query(sql, [team.id]);
  let normalizedAuths = {};
  let normalizedCoachAuths = {};
  for (let i = 0; i < playerAuths.length; i++) {
    const key = playerAuths[i].auth;
    if (playerAuths[i].coach) {
      if (playerAuths[i].name == "") normalizedCoachAuths[key] = "";
      else normalizedCoachAuths[key] = playerAuths[i].name;
    } else {
      if (playerAuths[i].name == "") normalizedAuths[key] = "";
      else normalizedAuths[key] = playerAuths[i].name;
    }
  }
  let teamData = {
    name: team.name,
    tag: team.tag,
    flag: team.flag != null
      ? team.flag.toUpperCase()
      : '',
    logo: team.logo,
    matchtext: team.matchtext,
    players: normalizedAuths,
    coaches: Object.keys(normalizedCoachAuths).length == 0 
      ? null
      : normalizedCoachAuths,
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
  return JSON.stringify(teamData);
}

export default router;
