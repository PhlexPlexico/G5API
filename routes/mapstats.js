/**
 * @swagger
 * resourcePath: /mapstats
 * description: Express API router for mapstats in get5.
 */
import { Router } from "express";
import app from "../app.js";

const router = Router();

import db from "../db.js";

import Utils from "../utility/utils.js";

import GlobalEmitter from "../utility/emitter.js";

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     MapStatsData:
 *       type: object
 *       required:
 *          - map_stats_id
 *          - match_id
 *          - map_number
 *          - start_time
 *       properties:
 *         map_stats_id:
 *           type: integer
 *           description: The unique identifier of map stats for a match.
 *         match_id:
 *           type: integer
 *           description: Foreign key ID that links back to the match.
 *         winner:
 *           type: integer
 *           description: Foreign key ID to the team that won.
 *         map_number:
 *           type: integer
 *           description: The current map number in a best-of series.
 *         team1_score:
 *           type: integer
 *           description: The score from team 1.
 *         team2_score:
 *           type: integer
 *           description: The score from team 2.
 *         start_time:
 *           type: string
 *           format: date-time
 *           description: Start time of a match in date time format.
 *         end_time:
 *           type: string
 *           format: date-time
 *           description: End time of a match in date time format.
 *         demoFile:
 *           type: string
 *           description: The URL pointing to the demo uploaded.
 *
 *   responses:
 *     MatchAlreadyFinished:
 *       description: Match already finished.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 *     NoMapStatData:
 *       description: Map Stat Data was not provided.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /mapstats/:
 *   get:
 *     description: Stats for all maps in all matches.
 *     produces:
 *       - application/json
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Stats for all maps in all matches.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM map_stats";
    let mapstats = await db.query(sql);
    if (!mapstats.length) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json({ mapstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats/:match_id:
 *   get:
 *     description: Set of map stats from a match
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Stats for all maps in all matches.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM map_stats where match_id = ?";
    let mapstats = await db.query(sql, matchID);
    if (!mapstats.length) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json({ mapstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats/:match_id/stream:
 *   get:
 *     description: Set of map stats from a match provided as an event-stream for real time updates.
 *     produces:
 *       - text/event-stream
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Stats for all maps in all matches.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:match_id/stream", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM map_stats where match_id = ?";
    let mapstats = await db.query(sql, matchID);
    
    res.set({
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    mapstats = mapstats.map(v => Object.assign({}, v));
    let mapStatString = `event: mapstats\ndata: ${JSON.stringify(mapstats)}\n\n`
    
    // Need to name the function in order to remove it!
    const mapStatStreamStats = async () => {
      mapstats = await db.query(sql, matchID);
      mapstats = mapstats.map(v => Object.assign({}, v));
      mapStatString = `event: mapstats\ndata: ${JSON.stringify(mapstats)}\n\n`
      res.write(mapStatString);
    };

    GlobalEmitter.on("mapStatUpdate", mapStatStreamStats);

    res.write(mapStatString);
    req.on("close", () => {
      GlobalEmitter.removeListener("mapStatUpdate", mapStatStreamStats);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("mapStatUpdate", mapStatStreamStats);
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
 * /mapstats/:match_id/:map_number/stream:
 *   get:
 *     description: Map statistics for a given match and map number provided as a text/event-stream for real time data info.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *          type: integer
 *       - name: map_number
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Stats for a single given map in a match.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id/:map_number/stream", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let mapID = req.params.map_number;
    let sql = "SELECT * FROM map_stats where match_id = ? AND map_number = ?";
    let mapstats = await db.query(sql, [matchID, mapID]);
    
    res.set({
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream"
    });
    res.flushHeaders();
    mapstats = mapstats.map(v => Object.assign({}, v));
    let mapStatString = `event: mapstats\ndata: ${JSON.stringify(mapstats[0])}\n\n`
    
    // Need to name the function in order to remove it!
    const mapStatStreamStats = async () => {
      mapstats = await db.query(sql, matchID);
      mapstats = mapstats.map(v => Object.assign({}, v));
      mapStatString = `event: mapstats\ndata: ${JSON.stringify(mapstats)}\n\n`
      res.write(mapStatString);
    };

    GlobalEmitter.on("mapStatUpdate", mapStatStreamStats);

    res.write(mapStatString);
    req.on("close", () => {
      GlobalEmitter.removeListener("mapStatUpdate", mapStatStreamStats);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("mapStatUpdate", mapStatStreamStats);
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
 * /mapstats/:match_id/:map_number:
 *   get:
 *     description: Map statistics for a given match and map number.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *          type: integer
 *       - name: map_number
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Stats for a single given map in a match.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:match_id/:map_number", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let mapID = req.params.map_number;
    let sql = "SELECT * FROM map_stats where match_id = ? AND map_number = ?";
    const mapstats = await db.query(sql, [matchID, mapID]);
    if (!mapstats.length) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    const mapstat = JSON.parse(JSON.stringify(mapstats[0]));
    res.json({ mapstat });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats:
 *   post:
 *     description: Add map stats for a match
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/MapStatsData'
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Map stats inserted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let errMessage = await Utils.getUserMatchAccess(
      req.body[0].match_id,
      req.user,
      false
    );
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      let mapStatSet = {
        match_id: req.body[0].match_id,
        map_number: req.body[0].map_number,
        map_name: req.body[0].map_name,
        start_time: req.body[0].start_time,
      };
      let sql = "INSERT INTO map_stats SET ?";
      let insertedStats = await db.query(sql, [mapStatSet]);
      GlobalEmitter.emit("mapStatUpdate");
      res.json({
        message: "Map stats inserted successfully!",
        id: insertedStats.insertId,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats:
 *   put:
 *     description: Update a map stats object when it is completed
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/MapStatsData'
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Map stats updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoMapStatData'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(412).json({ message: "Map stat ID Not Provided" });
      return;
    }
    let currentMatchInfo = "SELECT match_id FROM map_stats WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.body[0].map_stats_id);
    let errMessage = await Utils.getUserMatchAccess(
      matchRow[0].match_id,
      req.user,
      false
    );
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      let mapStatId = req.body[0].map_stats_id;
      let updatedValues = {
        end_time: req.body[0].end_time,
        team1_score: req.body[0].team1_score,
        team2_score: req.body[0].team2_score,
        winner: req.body[0].winner,
        demoFile: req.body[0].demo_file,
        map_name: req.body[0].map_name,
      };
      updatedValues = await db.buildUpdateStatement(updatedValues);
      if (!Object.keys(updatedValues)) {
        res
          .status(412)
          .json({ message: "No update data has been provided." });
        return;
      }
      let sql = "UPDATE map_stats SET ? WHERE id = ?";
      const updateMapStats = await db.query(sql, [updatedValues, mapStatId]);
      if (updateMapStats.affectedRows > 0) {
        GlobalEmitter.emit("mapStatUpdate");
        res.json({ message: "Map Stats updated successfully!" });
      }
      else
        res
          .status(401)
          .json({ message: "ERROR - Maps Stats not updated or found." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats:
 *   delete:
 *     description: Delete a map stats object
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              map_stats_id:
 *                type: integer
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Mapstat deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoMapStatData'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(412).json({ message: "Map Stats ID Not Provided" });
      return;
    }
    let currentMatchInfo = "SELECT match_id FROM map_stats WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.body[0].map_stats_id);
    let errMessage = await Utils.getUserMatchAccess(
      matchRow[0].match_id,
      req.user,
      false
    );
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      let mapStatsId = req.body[0].map_stats_id;
      let deleteSql = "DELETE FROM map_stats WHERE id = ?";
      const delRows = await db.query(deleteSql, [mapStatsId]);
      if (delRows.affectedRows > 0) {
        GlobalEmitter.emit("mapStatUpdate");
        res.json({ message: "Map Stats deleted successfully!" });
      }
        
      else
        res
          .status(400)
          .json({ message: "ERR - Unauthorized to delete OR not found." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err });
  }
});

export default router;
