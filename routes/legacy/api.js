/** Express API router for teams in get5.
 * @module routes/legacy/api
 * @requires express
 * @requires db
 */
import { Router } from "express";
/** Express module
 * @const
 */
const router = Router();
/** Database module.
 * @const
 */
import db from "../../db.js";

/** Rate limit includes.
 * @const
 */
import rateLimit from "express-rate-limit";

/** ZIP files.
 * @const
 */
import JSZip from "jszip";

/** Required to save files.
 * @const
 */
import { existsSync, mkdirSync, writeFile } from "fs";

/** Config to check demo uploads.
 * @const
 */
import config from "config";

/** 
 * @const
 * Global Server Sent Emitter class for real time data.
 */
import GlobalEmitter from "../../utility/emitter.js";

/** Basic Rate limiter.
 * @const
 */
const basicRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 180,
  message: "Too many requests from this IP. Please try again in an hour.",
  keyGenerator: async (req) => {
    try {
      let apiKey =
        req.body?.key == null
        ? req.params?.api_key
        : req.body?.key;
      const api_key = await db.query(
        "SELECT api_key FROM `match` WHERE id = ?",
        req.params.match_id
      );
      if (api_key[0].api_key.localeCompare(apiKey))
        return api_key[0].api_key;
      else return req.ip;
    } catch (err) {
      return req.ip;
    }
  },
});

/** Map Update Rate Limiter.
 * @const
 */
const updateMapRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP. Please try again in an hour.",
  keyGenerator: async (req) => {
    try {
      const api_key = await db.query(
        "SELECT api_key FROM `match` WHERE id = ?",
        req.params.match_id
      );
      if (api_key[0].api_key.localeCompare(keyCheck(req)))
        return api_key[0].api_key;
      else return req.ip;
    } catch (err) {
      return req.ip;
    }
  },
});

/** Player Stats Rate Limiter.
 * @const
 */
const playerStatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many requests from this IP. Please try again in an hour.",
  keyGenerator: async (req) => {
    try {
      const api_key = await db.query(
        "SELECT api_key FROM `match` WHERE id = ?",
        req.params.match_id
      );
      if (api_key[0].api_key.localeCompare(keyCheck(req)))
        return api_key[0].api_key;
      else return req.ip;
    } catch (err) {
      return req.ip;
    }
  },
});

/** Fetch for Challonge API integration.
 * @const
 */
import fetch from "node-fetch";
import Utils from "../../utility/utils.js";

/** A function to check for the API key in the request headers or body.
 * @const
 */
const keyCheck = (request) => {
  if (!request.body.key) {
    return request.get("key"); 
  }
  return request.body.key;
}

/**
 * @swagger
 *
 * /match/:match_id/finish:
 *   post:
 *     description: Finalizes the match. Called from the G5WS plugin.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              winner:
 *                type: string
 *                description: The string for which team won the match. team1 or team2.
 *              forfeit:
 *                type: integer
 *                description: Optional if a team has forfeit a match.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/finish", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let winner = req.body.winner == null ? null : req.body.winner;
    let forfeit = req.body.forfeit == null ? 0 : req.body.forfeit;
    let cancelled = null;
    let team1Score = req.body.team1score;
    let team2Score = req.body.team2score;

    // Local data manipulation.
    let teamIdWinner = null;
    let end_time = new Date().toISOString().slice(0, 19).replace("T", " ");
    let matchFinalized = true;
    // Database calls.
    let sql = "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    // Additional check here to see if we are cancelled through /cancel or not.
    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;
    // Throw error if wrong.
    // Special edge case for cancelled matches on remote server.
    // DO NOT throw error, just do nothing and report back we're finalized.
    if (matchValues[0].api_key.localeCompare(keyCheck(req)) !== 0)
      throw "Not a correct API Key.";
    if (matchFinalized == true) {
      res.status(200).send({ message: "Match already finalized" });
      return;
    }

    if (winner === "team1") teamIdWinner = matchValues[0].team1_id;
    else if (winner === "team2") teamIdWinner = matchValues[0].team2_id;
    // Check to see if we're in a BO2 situation.
    else if (winner === "none" && (matchValues[0].max_maps != 2) && (team1Score == 0 && team2Score == 0)) {
      teamIdWinner = null;
      cancelled = 1;
      forfeit = 0;
    }
    if (forfeit === 1) {
      if (winner === "team1") {
        team1Score = 1;
        team2Score = 0;
      } else if (winner === "team2") {
        team1Score = 0;
        team2Score = 1;
      } else if (winner === "none") {
        team1Score = 0;
        team2Score = 0;
      }
    }

    let updateStmt = {
      winner: teamIdWinner,
      forfeit: forfeit,
      team1_score: team1Score,
      team2_score: team2Score,
      start_time:
        matchValues[0].start_time ||
        new Date().toISOString().slice(0, 19).replace("T", " "),
      end_time: end_time,
      cancelled: cancelled
    };
    updateStmt = await db.buildUpdateStatement(updateStmt);
    let updateSql = "UPDATE `match` SET ? WHERE id = ?";
    await db.query(updateSql, [updateStmt, matchID]);
    // Set the server to not be in use.
    await db.query("UPDATE game_server SET in_use = 0 WHERE id = ?", [
      matchValues[0].server_id,
    ]);

    // Check if we are pugging.
    if (matchValues[0].is_pug != null && matchValues[0].is_pug == 1) {
      let mapStatIdSql =
        "SELECT id FROM map_stats WHERE match_id = ? ORDER BY map_number desc";
      const finalMapStat = await db.query(mapStatIdSql, [matchID]);
      let newMapStat;
      if (!finalMapStat.length) {
        let newMapStatStmt = {
          start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          winner: null,
          team1_score: 0,
          team2_score: 0,
          match_id: matchID,
        };
        mapStatIdSql = "INSERT map_stats SET ?";
        newMapStat = await db.query(mapStatIdSql, [newMapStatStmt]);
      }
      await Utils.updatePugStats(
        matchID,
        !finalMapStat.length ? newMapStat.insertId : finalMapStat[0].id,
        matchValues[0].team1_id,
        matchValues[0].team2_id,
        teamIdWinner
      );
    }
    // Check if a match has a season ID and we're not cancelled.
    if (matchValues[0].season_id && !cancelled) {
      await update_challonge_match(
        matchID,
        matchValues[0].season_id,
        matchValues[0].team1_id,
        matchValues[0].team2_id,
        matchValues[0].max_maps,
        winner
      );
    }
    GlobalEmitter.emit("matchUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.toString() });
    console.error(err);
  }
});

/**
 * @swagger
 *
 *  /match/:match_id/pause:
 *   post:
 *     description: Updates the database value if a match is paused from in-game.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              pause_type:
 *                type: string
 *                description: The string for what type of pause has been fired off.
 *              team_paused:
 *                type: string
 *                description: Which team has paused the game.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/pause/", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let pauseType = req.body.pause_type == null ? null : req.body.pause_type;
    let teamPaused = req.body.team_paused == null ? 0 : req.body.team_paused;

    let matchFinalized = true;
    // Database calls.
    let sql = "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;
    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

    sql = "SELECT * FROM match_pause WHERE match_id = ?";
    const pauseCheck = await db.query(sql, matchID);
    let teamName;
    if (teamPaused == "team1") teamName = matchValues[0].team1_string;
    else if (teamPaused == "team2") teamName = matchValues[0].team2_string;
    else teamName = "Admin";
    if (!pauseCheck.length) {
      sql = "INSERT INTO match_pause SET ?";
      let insertSet = {
        match_id: matchID,
        pause_type: pauseType,
        team_paused: teamName,
        paused: true
      };
      insertSet = await db.buildUpdateStatement(insertSet);
      await db.query(sql, [insertSet]);
    } else {
      sql = "UPDATE match_pause SET ? WHERE match_id = ?";
      let updateSet = {
        pause_type: pauseType,
        team_paused: teamName,
        paused: true
      };
      updateSet = await db.buildUpdateStatement(updateSet);
      await db.query(sql, [updateSet, matchID]);
    }
    GlobalEmitter.emit("matchUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error on game server.", response: err });
  }
}
);

/**
 * @swagger
 *
 *  /match/:match_id/unpause:
 *   post:
 *     description: Updates the database value if a match is unpaused from in-game.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              team_unpaused:
 *                type: string
 *                description: Which team has unpaused the game.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/unpause/", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let teamUnpaused = req.body.team_inpaused == null ? 0 : req.body.team_unpaused;

    let matchFinalized = true;
    // Database calls.
    let sql = "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;
    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

    sql = "SELECT * FROM match_pause WHERE match_id = ?";
    const pauseCheck = await db.query(sql, matchID);
    let teamName;
    if (teamUnpaused == "team1") teamName = matchValues[0].team1_string;
    else if (teamUnpaused == "team2") teamName = matchValues[0].team2_string;
    else teamName = "Admin";
    if (!pauseCheck.length) {
      sql = "INSERT INTO match_pause SET ?";
      let insertSet = {
        match_id: matchID,
        team_paused: teamName,
        paused: false
      };
      insertSet = await db.buildUpdateStatement(insertSet);
      await db.query(sql, [insertSet]);
    } else {
      sql = "UPDATE match_pause SET ? WHERE match_id = ?";
      let updateSet = {
        pause_type: null,
        team_paused: teamName,
        paused: false
      };
      updateSet = await db.buildUpdateStatement(updateSet);
      await db.query(sql, [updateSet, matchID]);
    }
    GlobalEmitter.emit("matchUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error on game server.", response: err });
  }
}
);

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/start:
 *   post:
 *     description: Begin a map within a match series.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              map_number:
 *                type: integer
 *                description: The given map number to start.
 *              mapname:
 *                type: string
 *                description: The given map name to update in the map stats object.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post(
  "/:match_id/map/:map_number/start",
  basicRateLimit,
  async (req, res, next) => {
    try {
      // Give from API call.
      let matchID = req.params.match_id == null ? null : req.params.match_id;
      let mapNumber =
        req.params.map_number == null ? null : req.params.map_number;
      let mapName = req.body.mapname == null ? null : req.body.mapname;
      let versionNumber = req.body.version_number == null ? null : req.body.version_number;
      // Data manipulation inside function.
      let startTime = new Date().toISOString().slice(0, 19).replace("T", " ");
      let updateStmt = {};
      let insertStmt = {};
      let updateSql;
      let insertSql;
      let matchFinalized = true;
      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      const matchValues = await db.query(sql, matchID);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key or finished match.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

      // Begin transaction
      if (matchValues[0].start_time == null) {
        // Update match stats to have a start time.
        updateStmt = {
          start_time: startTime,
        };
        updateSql = "UPDATE `match` SET ? WHERE id = ?";
        await db.query(updateSql, [updateStmt, matchID]);
      }

      if (versionNumber && matchValues[0].plugin_version == "unknown") {
        updateStmt = {
          plugin_version: versionNumber
        };
        updateSql = "UPDATE `match` SET ? WHERE id = ?";
        await db.query(updateSql, [updateStmt, matchID]);
      }

      // Get or create mapstats.
      sql = "SELECT * FROM map_stats WHERE match_id = ? AND map_number = ?";
      const mapStats = await db.query(sql, [matchID, mapNumber]);
      if (mapStats.length > 0) {
        updateStmt = {
          map_number: mapNumber,
          map_name: mapName,
        };
        updateSql =
          "UPDATE map_stats SET ? WHERE match_id = ? AND map_number = ?";
        // Remove any values that may not be updated.
        updateStmt = await db.buildUpdateStatement(updateStmt);
        await db.query(updateSql, [updateStmt, matchID, mapNumber]);
      } else {
        insertStmt = {
          match_id: matchID,
          map_number: mapNumber,
          map_name: mapName,
          start_time: startTime,
          team1_score: 0,
          team2_score: 0,
        };
        insertSql = "INSERT INTO map_stats SET ?";
        await db.query(insertSql, [insertStmt]);
      }
      GlobalEmitter.emit("mapStatUpdate");
      res.status(200).send({ message: "Success" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: err.toString() });
      console.error(err);
    }
  }
);

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/update:
 *   post:
 *     description: Update a match with the score.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              team1_score:
 *                type: integer
 *                description: The score for team1.
 *              team2_score:
 *                type: integer
 *                description: The score for team2.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *              map_number:
 *                type: integer
 *                description: The given map number from the URI path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post(
  "/:match_id/map/:map_number/update",
  updateMapRateLimit,
  async (req, res, next) => {
    try {
      // Give from API call.
      let matchID = req.params.match_id == null ? null : req.params.match_id;
      let mapNumber =
        req.params.map_number == null ? null : req.params.map_number;
      let team1Score = req.body.team1score;
      let team2Score = req.body.team2score;
      // Data manipulation inside function.
      let updateStmt = {};
      let updateSql;
      let matchFinalized = true;
      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      const matchValues = await db.query(sql, matchID);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;

      // Throw error if wrong key or finished match.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

      // Get or create mapstats.
      sql = "SELECT * FROM map_stats WHERE match_id = ? AND map_number = ?";

      const mapStats = await db.query(sql, [matchID, mapNumber]);
      if (mapStats.length > 0) {
        if (team1Score !== -1 && team2Score !== -1) {
          updateStmt = {
            team1_score: team1Score,
            team2_score: team2Score,
          };
          updateSql =
            "UPDATE map_stats SET ? WHERE match_id = ? AND map_number = ?";
          await db.query(updateSql, [updateStmt, matchID, mapNumber]);
          if (matchValues[0].max_maps == 1 && matchValues[0].season_id != null) {
            // Live update the score.
            await update_challonge_match(matchID,
              matchValues[0].season_id,
              matchValues[0].team1_id,
              matchValues[0].team2_id,
              matchValues[0].max_maps
            );
          }
          GlobalEmitter.emit("mapStatUpdate");
          res.status(200).send({ message: "Success" });
        } else {
          res.status(404).send({ message: "Failed to find map stats object" });
        }
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: err.toString() });
      console.error(err);
    }
  }
);

/**
 * @swagger
 *
 * /match/:match_id/vetoUpdate:
 *   post:
 *     description: Route serving to update the vetos in the database.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              teamString:
 *                type: string
 *                description: The team string consisting of either team1, team2, or nothing.
 *              map:
 *                type: string
 *                description: The map the team has picked or banned.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *              pick_or_veto:
 *                type: string
 *                description: The action taken upon the team.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/vetoUpdate", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let teamString = req.body.teamString == null ? null : req.body.teamString;
    let mapBan = req.body.map == null ? null : req.body.map;
    let pickOrBan =
      req.body.pick_or_veto == null ? null : req.body.pick_or_veto;
    // Data manipulation inside function.
    let insertStmt = {};
    let insertSql;
    let teamID;
    let teamNameString;
    let matchFinalized = true;
    // Database calls.
    let sql = "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);
    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;

    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);
    
    if (teamString === "team1") teamID = matchValues[0].team1_id;
    else if (teamString === "team2") teamID = matchValues[0].team2_id;

    sql = "SELECT name FROM team WHERE ID = ?";
    const teamName = await db.query(sql, [teamID]);
    if (teamName[0] == null) teamNameString = "Decider";
    else teamNameString = teamName[0].name;
    // Insert into veto now.
    insertStmt = {
      match_id: matchID,
      team_name: teamNameString,
      map: mapBan,
      pick_or_veto: pickOrBan,
    };
    // Remove any values that may not be updated.
    insertStmt = await db.buildUpdateStatement(insertStmt);
    insertSql = "INSERT INTO veto SET ?";
    await db.query(insertSql, [insertStmt]);
    GlobalEmitter.emit("vetoUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
    console.error(err);
  }
});

/**
 * @swagger
 *
 * /match/:match_id/vetoSideUpdate:
 *   post:
 *     description: Route serving to update the side selection from vetoes into the database.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              teamString:
 *                type: string
 *                description: The team string consisting of either team1, team2, or nothing.
 *              map:
 *                type: string
 *                description: The map the team has picked or banned.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *              side:
 *                type: string
 *                description: Which side the team has chosen.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/vetoSideUpdate", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let teamString = req.body.teamString == null ? null : req.body.teamString;
    let mapBan = req.body.map == null ? null : req.body.map;
    let sideChosen =
      req.body.side == null ? null : req.body.side;
    // Data manipulation inside function.
    let insertStmt = {};
    let insertSql;
    let teamBanID;
    let teamPickID;
    let vetoID;
    let teamPickMapNameString;
    let teamPickSideNameString;
    let matchFinalized = true;
    // Database calls.
    let sql = "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);
    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;

    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

    // Swap these as we are looking at the team who picked, not banned right now.
    if (teamString === "team1") {
      teamPickID = matchValues[0].team1_id;
      teamBanID = matchValues[0].team2_id;
    }
    else if (teamString === "team2") {
      teamBanID = matchValues[0].team1_id;
      teamPickID = matchValues[0].team2_id;
    }

    sql = "SELECT name FROM team WHERE ID = ?";
    const teamPickMapName = await db.query(sql, [teamBanID]);
    if (teamPickMapName[0] == null) teamPickMapNameString = "Default";
    else teamPickMapNameString = teamPickMapName[0].name;

    const teamPickSideName = await db.query(sql, [teamPickID]);
    if (teamPickSideName[0] == null) teamPickSideNameString = "Default";
    else teamPickSideNameString = teamPickSideName[0].name;

    // Retrieve veto id with team name and map veto.
    sql = "SELECT id FROM veto WHERE match_id = ? AND team_name = ? AND map = ?";
    const vetoInfo = await db.query(sql, [matchID, teamPickMapNameString, mapBan]);
    vetoID = vetoInfo[0].id;

    // Insert into veto_side now.
    insertStmt = {
      match_id: matchID,
      veto_id: vetoID,
      team_name: teamPickSideNameString,
      map: mapBan,
      side: sideChosen,
    };
    // Remove any values that may not be updated.
    insertStmt = await db.buildUpdateStatement(insertStmt);
    insertSql = "INSERT INTO veto_side SET ?";
    await db.query(insertSql, [insertStmt]);
    GlobalEmitter.emit("vetoSideUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
    console.error(err);
  }
});

/**
 * @swagger
 *
 *  /:match_id/map/:map_number/demo:
 *   post:
 *     description: Route serving to update the demo link per map.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              map_number:
 *                type: integer
 *                description: The map id of a given match.
 *              demoFile:
 *                type: string
 *                description: The URL for a demo file in string form.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post(
  "/:match_id/map/:map_number/demo",
  basicRateLimit,
  async (req, res, next) => {
    try {
      // Give from API call.
      let matchID = req.params.match_id == null ? null : req.params.match_id;
      let mapNum = req.params.map_number == null ? null : req.params.map_number;
      let demoFile = req.body.demoFile == null ? null : req.body.demoFile;
      // Data manipulation inside function.
      let updateStmt = {};
      let updateSql;
      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      const matchValues = await db.query(sql, matchID);
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, keyCheck(req), false);

      sql = "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues = await db.query(sql, [matchID, mapNum]);

      if (mapStatValues.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }

      // Update map stats with new demo file link.
      // If we have a demo that's in a path, remove and pop.
      updateStmt = {
        demoFile: demoFile.split("/").pop().replace("dem", "zip"),
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);

      updateSql = "UPDATE map_stats SET ? WHERE id = ?";
      await db.query(updateSql, [updateStmt, mapStatValues[0].id]);
      GlobalEmitter.emit("demoUpdate");
      res.status(200).send({ message: "Success" });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
      console.error(err);
    }
  }
);

/**
 * @swagger
 *
 *  /:match_id/map/:map_number/demo/upload/:
 *   put:
 *     description: Route serving to upload the demo file from the game server.
 *     parameters:
 *       - in: path
 *         name: match_id
 *         schema:
 *           type: integer
 *         required: true
 *       - in: path
 *         name: map_number
 *         schema:
 *           type: integer
 *         required: true
 *       - in: header
 *         name: key
 *         schema:
 *           type: string
 *         required: true
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/octet-stream:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                demoFile:
 *                  type: file
 *                  description: Demo file in octet stream form.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put(
  "/:match_id/map/:map_number/demo/upload/",
  basicRateLimit,
  async (req, res, next) => {
    if (!config.get("server.uploadDemos")) {
      res
        .status(403)
        .send({ message: "Demo uploads disabled for this server." });
      return;
    }
    try {
      let matchID = req.params.match_id;
      let mapNumber = req.params.map_number;
      // This is required since we're sending an octet stream.
      let apiKey = keyCheck(req);
      let zip = new JSZip();
      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      let currentDate = new Date();
      const matchValues = await db.query(sql, matchID);

      // Throw error if wrong key or finished match. Finalized match doesn't matter.
      // However, we do need a window of time where this request is only valid.
      // SO therefore we cannot use this, but need to check when the map is finished
      // and compare based on that if we kick out or not.
      // await check_api_key(matchValues[0].api_key, apiKey, false);
      if (matchValues[0].api_key.localeCompare(apiKey) !== 0)
        throw "Not a correct API Key.";

      sql =
        "SELECT id, demoFile, end_time FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues = await db.query(sql, [matchID, mapNumber]);

      if (mapStatValues.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }
      let endTimeMs = new Date(mapStatValues[0].end_time);
      let timeDifference = Math.abs(currentDate - endTimeMs);
      let minuteDifference = Math.floor((timeDifference / 1000) / 60);
      if (minuteDifference > 8) {
        res.status(500).json({ message: "Demo can no longer be uploaded." });
        return;
      }

      zip.file(mapStatValues[0].demoFile.replace(".zip", "") + ".dem", req.body, { binary: true });
      zip
        .generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
        .then((buf) => {
          writeFile(
            "public/demos/" + mapStatValues[0].demoFile,
            buf,
            "binary",
            function (err) {
              if (err) {
                console.log(err);
                throw err;
              }
            }
          );
        });
        GlobalEmitter.emit("demoUpdate");
      res.status(200).send({ message: "Success!" });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
      console.error(err);
    }
  }
);

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/finish:
 *   post:
 *     description: Route serving to finish a map within a series.
 *     produces:
 *       - text/plain
 *     requestBody:
 *      required: true
 *      content:
 *        text/plain:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: string
 *                description: The API key given from the game server to compare.
 *              winner:
 *                type: string
 *                description: The string representation of the winner, usually team1 or team2.
 *              map_number:
 *                type: integer
 *                description: The map id of a given match.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post(
  "/:match_id/map/:map_number/finish",
  basicRateLimit,
  async (req, res, next) => {
    try {
      // Give from API call.
      let matchID = req.params.match_id == null ? null : req.params.match_id;
      let mapNum = req.params.map_number == null ? null : req.params.map_number;
      let winner = req.body.winner == null ? null : req.body.winner;
      let team1Score;
      let team2Score;

      // Data manipulation inside function.
      let updateStmt = {};
      let updateSql;
      let mapEndTime = new Date().toISOString().slice(0, 19).replace("T", " ");
      let matchFinalized = true;
      let teamIdWinner;
      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      const matchValues = await db.query(sql, matchID);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);
      
      sql = "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues = await db.query(sql, [matchID, mapNum]);

      if (mapStatValues.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }
      if (winner == "team1") {
        teamIdWinner = matchValues[0].team1_id;
        team1Score = matchValues[0].team1_score + 1;
      } else if (winner == "team2") {
        teamIdWinner = matchValues[0].team2_id;
        team2Score = matchValues[0].team2_score + 1;
      }
      updateStmt = {
        end_time: mapEndTime,
        winner: teamIdWinner,
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);
      updateSql = "UPDATE map_stats SET ? WHERE id = ?";
      await db.query(updateSql, [updateStmt, mapStatValues[0].id]);
      // Update match now.
      updateStmt = {
        team1_score: team1Score,
        team2_score: team2Score,
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);
      updateSql = "UPDATE `match` SET ? WHERE ID = ?";
      await db.query(updateSql, [updateStmt, matchID]);

      if (matchValues[0].is_pug != null && matchValues[0].is_pug == 1) {
        await Utils.updatePugStats(
          matchID,
          mapStatValues[0].id,
          matchValues[0].team1_id,
          matchValues[0].team2_id,
          teamIdWinner,
          false
        );
      }
      if (matchValues[0].max_maps != 1 && matchValues[0].season_id != null) {
        // Live update the score.
        await update_challonge_match(matchID,
          matchValues[0].season_id,
          matchValues[0].team1_id,
          matchValues[0].team2_id,
          matchValues[0].max_maps
        );
      }
      GlobalEmitter.emit("mapStatUpdate");
      res.status(200).send({ message: "Success" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: err.toString() });
      console.error(err);
    }
  }
);

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/player/:steam_id/update:
 *   post:
 *     description: Route serving to update a players stats within a match.
 *     produces:
 *       - text/plain
 *     requestBody:
 *      required: true
 *      content:
 *        text/plain:
 *          schema:
 *            $ref: '#/components/schemas/PlayerStats'
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post(
  "/:match_id/map/:map_number/player/:steam_id/update",
  playerStatRateLimit,
  async (req, res, next) => {
    try {
      // Give from API call.
      let matchID =
        req.params.match_id == null ? null : parseInt(req.params.match_id);
      let mapNum =
        req.params.map_number == null ? null : parseInt(req.params.map_number);
      let steamId = req.params.steam_id == null ? null : req.params.steam_id;
      let playerName = req.body.name == null ? null : req.body.name;
      let playerTeam = req.body.team == null ? null : req.body.team;
      let playerKills =
        req.body.kills == null ? null : parseInt(req.body.kills);
      let playerAssists =
        req.body.assists == null ? null : parseInt(req.body.assists);
      let playerDeaths =
        req.body.deaths == null ? null : parseInt(req.body.deaths);
      let playerFBA =
        req.body.flashbang_assists == null
          ? null
          : parseInt(req.body.flashbang_assists);
      let playerTKs =
        req.body.teamkills == null ? null : parseInt(req.body.teamkills);
      let playerSuicide =
        req.body.suicides == null ? null : parseInt(req.body.suicides);
      let playerDamage =
        req.body.damage == null ? null : parseInt(req.body.damage);
      let playerHSK =
        req.body.headshot_kills == null
          ? null
          : parseInt(req.body.headshot_kills);
      let playerRoundsPlayed =
        req.body.roundsplayed == null ? null : parseInt(req.body.roundsplayed);
      let playerBombsPlanted =
        req.body.bomb_plants == null ? null : parseInt(req.body.bomb_plants);
      let playerBombsDefused =
        req.body.bomb_defuses == null ? null : parseInt(req.body.bomb_defuses);
      let player1k =
        req.body["1kill_rounds"] == null
          ? null
          : parseInt(req.body["1kill_rounds"]);
      let player2k =
        req.body["2kill_rounds"] == null
          ? null
          : parseInt(req.body["2kill_rounds"]);
      let player3k =
        req.body["3kill_rounds"] == null
          ? null
          : parseInt(req.body["3kill_rounds"]);
      let player4k =
        req.body["4kill_rounds"] == null
          ? null
          : parseInt(req.body["4kill_rounds"]);
      let player5k =
        req.body["5kill_rounds"] == null
          ? null
          : parseInt(req.body["5kill_rounds"]);
      let player1v1 = req.body.v1 == null ? null : parseInt(req.body.v1);
      let player1v2 = req.body.v2 == null ? null : parseInt(req.body.v2);
      let player1v3 = req.body.v3 == null ? null : parseInt(req.body.v3);
      let player1v4 = req.body.v4 == null ? null : parseInt(req.body.v4);
      let player1v5 = req.body.v5 == null ? null : parseInt(req.body.v5);
      let playerFirstKillT =
        req.body.firstkill_t == null ? null : parseInt(req.body.firstkill_t);
      let playerFirstKillCT =
        req.body.firstkill_ct == null ? null : parseInt(req.body.firstkill_ct);
      let playerFirstDeathCT =
        req.body.firstdeath_ct == null
          ? null
          : parseInt(req.body.firstdeath_ct);
      let playerFirstDeathT =
        req.body.firstdeath_t == null ? null : parseInt(req.body.firstdeath_t);
      let playerKast = req.body.kast == null ? null : parseInt(req.body.kast);
      let playerContrib =
        req.body.contribution_score == null
          ? null
          : parseInt(req.body.contribution_score);
      let playerMvp =
        req.body.mvp == null
          ? null
          : parseInt(req.body.mvp);
      let knifeKills =
        req.body.knife_kills == null
          ? null
          : parseInt(req.body.knife_kills);
      let enemiesFlashed =
        req.body.enemies_flashed == null
          ? null
          : parseInt(req.body.enemies_flashed);
      let friendlyFlashed =
        req.body.friendlies_flashed == null
          ? null
          : parseInt(req.body.friendlies_flashed);
      let utilDmg = req.body.util_damage == null
        ? null
        : parseInt(req.body.util_damage);

      // Data manipulation inside function.
      let updateStmt = {};
      let updateSql;
      let matchFinalized = true;
      let playerTeamId;

      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      const matchValues = await db.query(sql, matchID);
      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

      sql = "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues = await db.query(sql, [matchID, mapNum]);
      if (mapStatValues.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }

      // Get player stats if exists, if not we create it.
      sql =
        "SELECT * FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
      const playerStatValues = await db.query(sql, [
        matchID,
        mapStatValues[0].id,
        steamId,
      ]);

      // Update player stats. ACID transaction.

      if (playerTeam === "team1") playerTeamId = matchValues[0].team1_id;
      else if (playerTeam === "team2") playerTeamId = matchValues[0].team2_id;

      updateStmt = {
        match_id: matchID,
        map_id: mapStatValues[0].id,
        team_id: playerTeamId,
        steam_id: steamId,
        name: playerName,
        kills: playerKills,
        deaths: playerDeaths,
        roundsplayed: playerRoundsPlayed,
        assists: playerAssists,
        flashbang_assists: playerFBA,
        teamkills: playerTKs,
        knife_kills: knifeKills,
        suicides: playerSuicide,
        headshot_kills: playerHSK,
        damage: playerDamage,
        util_damage: utilDmg,
        enemies_flashed: enemiesFlashed,
        friendlies_flashed: friendlyFlashed,
        bomb_plants: playerBombsPlanted,
        bomb_defuses: playerBombsDefused,
        v1: player1v1,
        v2: player1v2,
        v3: player1v3,
        v4: player1v4,
        v5: player1v5,
        k1: player1k,
        k2: player2k,
        k3: player3k,
        k4: player4k,
        k5: player5k,
        firstdeath_ct: playerFirstDeathCT,
        firstdeath_t: playerFirstDeathT,
        firstkill_ct: playerFirstKillCT,
        firstkill_t: playerFirstKillT,
        kast: playerKast,
        contribution_score: playerContrib,
        mvp: playerMvp
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);

      if (playerStatValues.length < 1) {
        updateSql = "INSERT INTO player_stats SET ?";
        await db.query(updateSql, [updateStmt]);
      } else {
        updateSql = "UPDATE player_stats SET ? WHERE id = ?";
        await db.query(updateSql, [
          updateStmt,
          playerStatValues[0].id,
        ]);
      }
      GlobalEmitter.emit("playerStatsUpdate");
      res.status(200).send({ message: "Success" });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
      console.error(err);
    }
  }
);

/**
 * @swagger
 *
 *  /:match_id/map/:map_number/backup:
 *   post:
 *     description: Route serving to upload the latest round backup to the server.
 *     parameters:
 *       - in: path
 *         name: match_id
 *         schema:
 *           type: integer
 *         required: true
 *       - in: path
 *         name: map_number
 *         schema:
 *           type: integer
 *         required: true
 *       - in: header
 *         name: key
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: round_number
 *         schema:
 *           type: integer
 *         required: true
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/octet-stream:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                backupFile:
 *                  type: file
 *                  description: The latest backup cfg file from the game server.
 *
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.put(
  "/:match_id/map/:map_number/round/:round_number/backup",
  basicRateLimit,
  async (req, res, next) => {
    try {
      let matchID = req.params.match_id;
      let mapNumber = req.params.map_number;
      // This is required since we're sending an octet stream.
      let apiKey = keyCheck(req);
      let roundNumber = req.params.round_number;
      // Database calls.
      let sql = "SELECT * FROM `match` WHERE id = ?";
      let matchFinalized = true;
      const matchValues = await db.query(sql, matchID);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, apiKey, matchFinalized);

      if(!existsSync(`public/backups/${matchID}/`)) mkdirSync(`public/backups/${matchID}/`, true);

      writeFile(
        `public/backups/${matchID}/get5_backup_match${matchID}_map${mapNumber}_round${roundNumber}.cfg`,
        req.body,
        function (err) {
          if (err) {
            console.log(err);
            throw err;
          }
        }
      );
      res.status(200).send({ message: "Success!" });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
      console.error(err);
    } finally {
      return;
    }
  }
);


/** Reports whether the match is given a correct API key, or if the match has finished.
 * @function
 * @memberof module:legacy/api
 * @param {string} match_api_key - The match API from the database.
 * @param {string} given_api_key - The given API key from the request.
 * @param {number} match_finished - Whether the match is finished or not.
 */
async function check_api_key(match_api_key, given_api_key, match_finished) {
  if (match_api_key.localeCompare(given_api_key) !== 0)
    throw "Not a correct API Key.";
  if (match_finished == true) throw "Match is already finalized.";
  return;
}

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
async function update_challonge_match(match_id, season_id, team1_id, team2_id, num_maps, winner = null) {
  // Check if a match has a season ID.
  let sql = "SELECT id, challonge_url, user_id FROM season WHERE id = ?";
  let team1Score;
  let team2Score;
  const seasonInfo = await db.query(sql, season_id);
  if (seasonInfo[0].challonge_url) {
    sql = "SELECT challonge_team_id FROM team WHERE id = ?";
    const team1ChallongeId = await db.query(sql, team1_id);
    const team2ChallongeId = await db.query(sql, team2_id);

    // Grab API key.
    sql = "SELECT challonge_api_key FROM user WHERE id = ?";
    const challongeAPIKey = await db.query(sql, [seasonInfo[0].user_id]);
    let decryptedKey = Utils.decrypt(challongeAPIKey[0].challonge_api_key);
    // Get info of the current open match with the two IDs.
    let challongeResponse = await fetch(
      "https://api.challonge.com/v1/tournaments/" +
      seasonInfo[0].challonge_url +
      "/matches.json?api_key=" + decryptedKey +
      "&state=open&participant_id=" +
      team1ChallongeId[0].challonge_team_id +
      "&participant_id=" +
      team2ChallongeId[0].challonge_team_id);
    let challongeData = await challongeResponse.json();
    if (challongeData) {
      if (num_maps == 1) {
        // Submit the map stats scores instead.
        sql = "SELECT team1_score, team2_score FROM map_stats WHERE match_id = ?";
      } else {
        sql = "SELECT team1_score, team2_score FROM `match` WHERE id = ?";
      }
      const mapStats = await db.query(sql, [match_id]);
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
      if(!challongeData) {
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

export default router;
