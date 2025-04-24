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
import {db} from "../../services/db.js";

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
      let apiKey: string =
        req.body?.key == null
          ? req.params?.api_key
          : req.body?.key;
      const api_key = await db.query(
        "SELECT api_key FROM `match` WHERE id = ?",
        [req.params.match_id]
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
      const api_key: RowDataPacket[] = await db.query(
        "SELECT api_key FROM `match` WHERE id = ?",
        [req.params.match_id]
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
      const api_key: RowDataPacket[] = await db.query(
        "SELECT api_key FROM `match` WHERE id = ?",
        [req.params.match_id]
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
import fetch, { Response } from "node-fetch";
import Utils from "../../utility/utils.js";
import { Request, ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { RowDataPacket } from "mysql2";
import { MatchData } from "../../types/matches/MatchData.js";
import { MatchPauseData } from "../../types/matches/MatchPauseData.js";
import { MapStats } from "../../types/mapstats/MapStats.js";
import { VetoSideObject } from "../../types/vetoes/VetoSideObject.js";
import { VetoObject } from "../../types/vetoes/VetoObject.js";
import { PlayerDatabaseObject } from "../../types/playerstats/PlayerDatabaseObject.js";

/** A function to check for the API key in the request headers or body.
 * @const
 */
const keyCheck = (request: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>) => {
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
    let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
    let winner: string | null = req.body.winner == null ? null : req.body.winner;
    let forfeit: number | null = req.body.forfeit == null ? 0 : req.body.forfeit;
    let cancelled: number | null = null;
    let team1Score: number | null = req.body.team1score;
    let team2Score: number | null = req.body.team2score;

    // Local data manipulation.
    let teamIdWinner = null;
    let end_time = new Date().toISOString().slice(0, 19).replace("T", " ");
    let matchFinalized = true;
    // Database calls.
    let sql = "SELECT * FROM `match` WHERE id = ?";
    const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

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

    if (matchID === null) {
      res.status(404).send({ message: "Match not found."});
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

    let updateStmt: MatchData = {
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
    let updateSql: string = "UPDATE `match` SET ? WHERE id = ?";
    await db.query(updateSql, [updateStmt, matchID]);
    // Set the server to not be in use.
    await db.query("UPDATE game_server SET in_use = 0 WHERE id = ?", [
      matchValues[0].server_id,
    ]);

    // Check if we are pugging.
    if (matchValues[0].is_pug != null && matchValues[0].is_pug == 1) {
      let mapStatIdSql =
        "SELECT id FROM map_stats WHERE match_id = ? ORDER BY map_number desc";
      const finalMapStat: RowDataPacket[] = await db.query(mapStatIdSql, [matchID]);
      let newMapStat: RowDataPacket[];
      if (!finalMapStat.length) {
        let newMapStatStmt: MatchData = {
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
        //@ts-ignore
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
    res.status(500).json({ message: (err as Error).toString() });
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
    let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
    let pauseType: string | null = req.body.pause_type == null ? null : req.body.pause_type;
    let teamPaused: string | null = req.body.team_paused == null ? 0 : req.body.team_paused;

    let matchFinalized = true;
    if (matchID === null) {
      res.status(404).json({ message: "Match not found." });
      return;
    }
    // Database calls.
    let sql: string = "SELECT * FROM `match` WHERE id = ?";
    const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;
    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

    sql = "SELECT * FROM match_pause WHERE match_id = ?";
    const pauseCheck: RowDataPacket[] = await db.query(sql, [matchID]);
    let teamName: string;
    if (teamPaused == "team1") teamName = matchValues[0].team1_string;
    else if (teamPaused == "team2") teamName = matchValues[0].team2_string;
    else teamName = "Admin";
    if (!pauseCheck.length) {
      sql = "INSERT INTO match_pause SET ?";
      let insertSet: MatchPauseData = {
        match_id: matchID,
        pause_type: pauseType,
        team_paused: teamName,
        paused: true
      };
      insertSet = await db.buildUpdateStatement(insertSet);
      await db.query(sql, [insertSet]);
    } else {
      sql = "UPDATE match_pause SET ? WHERE match_id = ?";
      let updateSet: MatchPauseData = {
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
    let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
    let teamUnpaused: string | null = req.body.team_inpaused == null ? 0 : req.body.team_unpaused;

    let matchFinalized: boolean | null = true;
    if (matchID === null) {
      res.status(404).json({ message: "Match not found." });
      return;
    }
    // Database calls.
    let sql: string = "SELECT * FROM `match` WHERE id = ?";
    const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;
    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

    sql = "SELECT * FROM match_pause WHERE match_id = ?";
    const pauseCheck: RowDataPacket[] = await db.query(sql, [matchID]);
    let teamName: string;
    if (teamUnpaused == "team1") teamName = matchValues[0].team1_string;
    else if (teamUnpaused == "team2") teamName = matchValues[0].team2_string;
    else teamName = "Admin";
    if (!pauseCheck.length) {
      sql = "INSERT INTO match_pause SET ?";
      let insertSet: MatchPauseData = {
        match_id: matchID,
        team_paused: teamName,
        paused: false
      };
      insertSet = await db.buildUpdateStatement(insertSet);
      await db.query(sql, [insertSet]);
    } else {
      sql = "UPDATE match_pause SET ? WHERE match_id = ?";
      let updateSet: MatchPauseData = {
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
      let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
      let mapNumber: number | null =
        req.params.map_number == null ? null : parseInt(req.params.map_number);
      let mapName: string | null = req.body.mapname == null ? null : req.body.mapname;
      let versionNumber: string | null = req.body.version_number == null ? null : req.body.version_number;
      // Data manipulation inside function.
      let startTime: string = new Date().toISOString().slice(0, 19).replace("T", " ");
      let updateStmt: MapStats | MatchData = {};
      let insertStmt: MapStats | MatchData = {};
      let updateSql: string;
      let insertSql: string;
      let matchFinalized = true;
      if (matchID === null || mapNumber === null) {
        res.status(404).json({ message: "Match not found." });
        return;
      }
      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

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
      const mapStats: RowDataPacket[] = await db.query(sql, [matchID, mapNumber]);
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
      res.status(500).json({ message: (err as Error).toString() });
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
      let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
      let mapNumber: number | null =
        req.params.map_number == null ? null : parseInt(req.params.map_number);
      let team1Score: number = req.body.team1score;
      let team2Score: number = req.body.team2score;
      // Data manipulation inside function.
      let updateStmt: MapStats = {};
      let updateSql: string;
      let matchFinalized: boolean = true;
      if (matchID === null || mapNumber === null) {
        res.status(404).json({ message: "Match not found." });
        return;
      }
      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;

      // Throw error if wrong key or finished match.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

      // Get or create mapstats.
      sql = "SELECT * FROM map_stats WHERE match_id = ? AND map_number = ?";

      const mapStats: RowDataPacket[] = await db.query(sql, [matchID, mapNumber]);
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
      res.status(500).json({ message: (err as Error).toString() });
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
    let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
    let teamString: string | null = req.body.teamString == null ? null : req.body.teamString;
    let mapBan: string | null = req.body.map == null ? null : req.body.map;
    let pickOrBan: string | null =
      req.body.pick_or_veto == null ? null : req.body.pick_or_veto;
    // Data manipulation inside function.
    let insertStmt: VetoObject;
    let insertSql: string;
    let teamID: number;
    let teamNameString: string;
    let matchFinalized: boolean = true;
    // Database calls.
    let sql: string = "SELECT * FROM `match` WHERE id = ?";
    const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);
    if (
      matchValues[0].end_time == null &&
      (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
    )
      matchFinalized = false;

    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

    if (teamString === "team1") teamID = matchValues[0].team1_id;
    else if (teamString === "team2") teamID = matchValues[0].team2_id;
    else teamID = 0;

    sql = "SELECT name FROM team WHERE ID = ?";
    const teamName: RowDataPacket[] = await db.query(sql, [teamID]);
    if (teamName[0] == null) teamNameString = "Decider";
    else teamNameString = teamName[0].name;
    // Insert into veto now.
    insertStmt = {
      match_id: +matchID!,
      team_name: teamNameString,
      map: mapBan!,
      pick_or_veto: pickOrBan!,
    };
    // Remove any values that may not be updated.
    insertStmt = await db.buildUpdateStatement(insertStmt) as VetoObject;
    insertSql = "INSERT INTO veto SET ?";
    await db.query(insertSql, [insertStmt]);
    GlobalEmitter.emit("vetoUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).toString() });
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
    let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
    let teamString: string | null = req.body.teamString == null ? null : req.body.teamString;
    let mapBan: string | null = req.body.map == null ? null : req.body.map;
    let sideChosen: string | null =
      req.body.side == null ? null : req.body.side;
    // Data manipulation inside function.
    let insertStmt: VetoSideObject;
    let insertSql: string;
    let teamBanID: number = 0;
    let teamPickID: number = 0;
    let vetoID: number;
    let teamPickMapNameString: string;
    let teamPickSideNameString: string;
    let matchFinalized: boolean = true;
    // Database calls.
    let sql: string = "SELECT * FROM `match` WHERE id = ?";
    const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);
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
    const teamPickMapName: RowDataPacket[] = await db.query(sql, [teamBanID]);
    if (teamPickMapName[0] == null) teamPickMapNameString = "Default";
    else teamPickMapNameString = teamPickMapName[0].name;

    const teamPickSideName: RowDataPacket[] = await db.query(sql, [teamPickID]);
    if (teamPickSideName[0] == null) teamPickSideNameString = "Default";
    else teamPickSideNameString = teamPickSideName[0].name;

    // Retrieve veto id with team name and map veto.
    sql = "SELECT id FROM veto WHERE match_id = ? AND team_name = ? AND map = ?";
    const vetoInfo: RowDataPacket[] = await db.query(sql, [matchID, teamPickMapNameString, mapBan]);
    vetoID = vetoInfo[0].id;

    // Insert into veto_side now.
    insertStmt = {
      match_id: +matchID!,
      veto_id: vetoID,
      team_name: teamPickSideNameString,
      map: mapBan!,
      side: sideChosen!,
    };
    // Remove any values that may not be updated.
    insertStmt = await db.buildUpdateStatement(insertStmt) as VetoSideObject;
    insertSql = "INSERT INTO veto_side SET ?";
    await db.query(insertSql, [insertStmt]);
    GlobalEmitter.emit("vetoSideUpdate");
    res.status(200).send({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).toString() });
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
      let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
      let mapNum: string | null = req.params.map_number == null ? null : req.params.map_number;
      let demoFile: string | null = req.body.demoFile == null ? null : req.body.demoFile;
      // Data manipulation inside function.
      let updateStmt: MapStats;
      let updateSql: string;
      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, keyCheck(req), false);

      sql = "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues: RowDataPacket[] = await db.query(sql, [matchID, mapNum]);

      if (mapStatValues.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }

      // Update map stats with new demo file link.
      // If we have a demo that's in a path, remove and pop.
      updateStmt = {
        demoFile: demoFile?.split("/").pop()?.replace("dem", "zip"),
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);

      updateSql = "UPDATE map_stats SET ? WHERE id = ?";
      await db.query(updateSql, [updateStmt, mapStatValues[0].id]);
      GlobalEmitter.emit("demoUpdate");
      res.status(200).send({ message: "Success" });
    } catch (err) {
      res.status(500).json({ message: (err as Error).toString() });
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
      let matchID: string = req.params.match_id;
      let mapNumber: number = parseInt(req.params.map_number);
      // This is required since we're sending an octet stream.
      let apiKey: string = keyCheck(req);
      let zip: JSZip = new JSZip();
      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      let currentDate: Date = new Date();
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

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
      let endTimeMs: Date = new Date(mapStatValues[0].end_time);
      let timeDifference: number = Math.abs(+currentDate - +endTimeMs);
      let minuteDifference: number = Math.floor((timeDifference / 1000) / 60);
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
      res.status(500).json({ message: (err as Error).toString() });
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
      let matchID: string | null = req.params.match_id == null ? null : req.params.match_id;
      let mapNum: number | null = req.params.map_number == null ? null : parseInt(req.params.map_number);
      let winner: string | null = req.body.winner == null ? null : req.body.winner;
      let team1Score: number | null = null;
      let team2Score: number | null = null;

      // Data manipulation inside function.
      let updateStmt: MapStats = {};
      let updateSql: string;
      let mapEndTime: string = new Date().toISOString().slice(0, 19).replace("T", " ");
      let matchFinalized: boolean = true;
      let teamIdWinner: number = 0;
      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

      sql = "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues: RowDataPacket[] = await db.query(sql, [matchID, mapNum]);

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
          matchID!,
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
      res.status(500).json({ message: (err as Error).toString() });
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
      let matchID: string | null =
        req.params.match_id == null ? null : req.params.match_id;
      let mapNum: number | null =
        req.params.map_number == null ? null : parseInt(req.params.map_number);
      let steamId: string | null = req.params.steam_id == null ? null : req.params.steam_id;
      let playerName: string | null = req.body.name == null ? null : req.body.name;
      let playerTeam: string | null = req.body.team == null ? null : req.body.team;
      let playerKills: number | null =
        req.body.kills == null ? null : parseInt(req.body.kills);
      let playerAssists: number | null =
        req.body.assists == null ? null : parseInt(req.body.assists);
      let playerDeaths: number | null =
        req.body.deaths == null ? null : parseInt(req.body.deaths);
      let playerFBA: number | null =
        req.body.flashbang_assists == null
          ? null
          : parseInt(req.body.flashbang_assists);
      let playerTKs: number | null =
        req.body.teamkills == null ? null : parseInt(req.body.teamkills);
      let playerSuicide: number | null =
        req.body.suicides == null ? null : parseInt(req.body.suicides);
      let playerDamage: number | null =
        req.body.damage == null ? null : parseInt(req.body.damage);
      let playerHSK: number | null =
        req.body.headshot_kills == null
          ? null
          : parseInt(req.body.headshot_kills);
      let playerRoundsPlayed: number | null =
        req.body.roundsplayed == null ? null : parseInt(req.body.roundsplayed);
      let playerBombsPlanted: number | null =
        req.body.bomb_plants == null ? null : parseInt(req.body.bomb_plants);
      let playerBombsDefused: number | null =
        req.body.bomb_defuses == null ? null : parseInt(req.body.bomb_defuses);
      let player1k: number | null =
        req.body["1kill_rounds"] == null
          ? null
          : parseInt(req.body["1kill_rounds"]);
      let player2k: number | null =
        req.body["2kill_rounds"] == null
          ? null
          : parseInt(req.body["2kill_rounds"]);
      let player3k: number | null =
        req.body["3kill_rounds"] == null
          ? null
          : parseInt(req.body["3kill_rounds"]);
      let player4k: number | null =
        req.body["4kill_rounds"] == null
          ? null
          : parseInt(req.body["4kill_rounds"]);
      let player5k: number | null =
        req.body["5kill_rounds"] == null
          ? null
          : parseInt(req.body["5kill_rounds"]);
      let player1v1: number | null = req.body.v1 == null ? null : parseInt(req.body.v1);
      let player1v2: number | null = req.body.v2 == null ? null : parseInt(req.body.v2);
      let player1v3: number | null = req.body.v3 == null ? null : parseInt(req.body.v3);
      let player1v4: number | null = req.body.v4 == null ? null : parseInt(req.body.v4);
      let player1v5: number | null = req.body.v5 == null ? null : parseInt(req.body.v5);
      let playerFirstKillT: number | null =
        req.body.firstkill_t == null ? null : parseInt(req.body.firstkill_t);
      let playerFirstKillCT: number | null =
        req.body.firstkill_ct == null ? null : parseInt(req.body.firstkill_ct);
      let playerFirstDeathCT: number | null =
        req.body.firstdeath_ct == null
          ? null
          : parseInt(req.body.firstdeath_ct);
      let playerFirstDeathT: number | null =
        req.body.firstdeath_t == null ? null : parseInt(req.body.firstdeath_t);
      let playerKast: number | null = req.body.kast == null ? null : parseInt(req.body.kast);
      let playerContrib: number | null =
        req.body.contribution_score == null
          ? null
          : parseInt(req.body.contribution_score);
      let playerMvp: number | null =
        req.body.mvp == null
          ? null
          : parseInt(req.body.mvp);
      let knifeKills: number | null =
        req.body.knife_kills == null
          ? null
          : parseInt(req.body.knife_kills);
      let enemiesFlashed: number | null =
        req.body.enemies_flashed == null
          ? null
          : parseInt(req.body.enemies_flashed);
      let friendlyFlashed: number | null =
        req.body.friendlies_flashed == null
          ? null
          : parseInt(req.body.friendlies_flashed);
      let utilDmg: number | null = req.body.util_damage == null
        ? null
        : parseInt(req.body.util_damage);

      // Data manipulation inside function.
      let updateStmt: PlayerDatabaseObject;
      let updateSql: string;
      let matchFinalized: boolean = true;
      let playerTeamId: number | null = null;

      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);
      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, keyCheck(req), matchFinalized);

      sql = "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      const mapStatValues: RowDataPacket[] = await db.query(sql, [matchID, mapNum]);
      if (mapStatValues.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }

      // Get player stats if exists, if not we create it.
      sql =
        "SELECT * FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
      const playerStatValues: RowDataPacket[] = await db.query(sql, [
        matchID,
        mapStatValues[0].id,
        steamId,
      ]);

      // Update player stats. ACID transaction.

      if (playerTeam === "team1") playerTeamId = matchValues[0].team1_id;
      else if (playerTeam === "team2") playerTeamId = matchValues[0].team2_id;

      updateStmt = {
        match_id: matchID!,
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
      updateStmt = await db.buildUpdateStatement(updateStmt) as PlayerDatabaseObject;

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
      res.status(500).json({ message: (err as Error).toString() });
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
      let matchID: string = req.params.match_id;
      let mapNumber: number = parseInt(req.params.map_number);
      // This is required since we're sending an octet stream.
      let apiKey: string = keyCheck(req);
      let roundNumber: number = parseInt(req.params.round_number);
      // Database calls.
      let sql: string = "SELECT * FROM `match` WHERE id = ?";
      let matchFinalized: boolean = true;
      const matchValues: RowDataPacket[] = await db.query(sql, [matchID]);

      if (
        matchValues[0].end_time == null &&
        (matchValues[0].cancelled == null || matchValues[0].cancelled == 0)
      )
        matchFinalized = false;
      // Throw error if wrong key. Match finish doesn't matter.
      await check_api_key(matchValues[0].api_key, apiKey, matchFinalized);

      if (!existsSync(`public/backups/${matchID}/`)) mkdirSync(`public/backups/${matchID}/`, {recursive: true});

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
      res.status(500).json({ message: (err as Error).toString() });
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
async function check_api_key(match_api_key: string, given_api_key: string, match_finished: boolean) {
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
async function update_challonge_match(match_id: string | null, season_id: number, team1_id: number, team2_id: number, num_maps: number, winner: string | null = null) {
  // Check if a match has a season ID.
  let sql: string = "SELECT id, challonge_url, user_id FROM season WHERE id = ?";
  let team1Score: number;
  let team2Score: number;
  const seasonInfo: RowDataPacket[] = await db.query(sql, [season_id]);
  if (seasonInfo[0].challonge_url) {
    sql = "SELECT challonge_team_id FROM team WHERE id = ?";
    const team1ChallongeId: RowDataPacket[] = await db.query(sql, [team1_id]);
    const team2ChallongeId: RowDataPacket[] = await db.query(sql, [team2_id]);

    // Grab API key.
    sql = "SELECT challonge_api_key FROM user WHERE id = ?";
    const challongeAPIKey: RowDataPacket[] = await db.query(sql, [seasonInfo[0].user_id]);
    let decryptedKey: string | null | undefined = Utils.decrypt(challongeAPIKey[0].challonge_api_key);
    // Get info of the current open match with the two IDs.
    let challongeResponse: Response = await fetch(
      "https://api.challonge.com/v1/tournaments/" +
      seasonInfo[0].challonge_url +
      "/matches.json?api_key=" + decryptedKey +
      "&state=open&participant_id=" +
      team1ChallongeId[0].challonge_team_id +
      "&participant_id=" +
      team2ChallongeId[0].challonge_team_id);
    // TODO: Use typings for challonge API calls.
    let challongeData: any[] = await challongeResponse.json() as any[];
    if (challongeData) {
      if (num_maps == 1) {
        // Submit the map stats scores instead.
        sql = "SELECT team1_score, team2_score FROM map_stats WHERE match_id = ?";
      } else {
        sql = "SELECT team1_score, team2_score FROM `match` WHERE id = ?";
      }
      const mapStats: RowDataPacket[] = await db.query(sql, [match_id]);
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
      challongeData = await challongeResponse.json() as any[];
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

export default router;
