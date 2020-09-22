/** Express API router for mapstats in get5.
 * @module routes/mapstats
 * @requires express
 * @requires db
 */

 /**
 * @swagger
 * resourcePath: /mapstats
 * description: Express API router for mapstats in get5.
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

/** Utility class for various methods used throughout.
 * @const */
const Utils = require("../utility/utils");


/**
 * @swagger
 *
 * components:
 *   schemas:
 *     SimpleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *   responses:
 *     BadRequest:
 *       description: Match ID not provided
 *     NotFound:
 *       description: The specified resource was not found.
 *     Unauthorized:
 *       description: Unauthorized
 *     MatchAlreadyFinished:
 *       description: Match already finished.
 *     MatchNotFound:
 *       description: Match not found.
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
 * /mapstats/:
 *   get:
 *     description: Stats for all servers
 *     produces:
 *       - application/json
 *     tags:
 *       - mapstats
 *     responses:
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM map_stats";
    const allStats = await db.query(sql);
    if (allStats.length === 0) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json(allStats);
  } catch (err) {
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
 *         type: integer
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Match stats
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
    matchID = req.params.match_id;
    let sql = "SELECT * FROM map_stats where match_id = ?";
    const mapStats = await db.query(sql, matchID);
    if (mapStats.length === 0) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json(mapStats);
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
 *            type: object
 *            properties:
 *              match_id:
 *                type: integer
 *                description: Match ID of the current match.
 *            map_number:
 *                type: integer
 *                description: Current map the match is on.
 *            map_name:
 *                type: string
 *                description: Name of the map.
 *            start_time:
 *              type: dateTime
 *              description: Time in date time format.
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Match stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/MatchNotFound'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].match_id == null) {
      res.status(400).json({ message: "Match ID Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT user_id, cancelled, forfeit, end_time FROM `match` WHERE id = ?";
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
      res.status(422).json({ message: "Match is already finished." });
      return;
    } else {
      await db.withTransaction(async () => {
        let mapStatSet = {
          match_id: req.body[0].match_id,
          map_number: req.body[0].map_number,
          map_name: req.body[0].map_name,
          start_time: req.body[0].start_time,
        };
        let sql = "INSERT INTO map_stats SET ?";
        await db.query(sql, [mapStatSet]);
        res.json({ message: "Map stats inserted successfully!" });
      });
    }
  } catch (err) {
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
 *            type: object
 *            required:
 *              - map_stats_id
 *            properties:
 *              map_stats_id:
 *                type: integer
 *              end_time:
 *                type: dateTime
 *                description: The time the match ended.
 *              team1_score:
 *                type: integer
 *                description: The score from team 1 in the map.
 *              team2_score:
 *                type: integer
 *                description: The score from team 2 in the map.
 *              winner:
 *                type: integer
 *                description: The Team ID of the team that won.
 *              demoFile:
 *                type: string
 *                description: The URL to the demo file, usually uploaded by get5.
 *              map_name:
 *                type: string
 *                description: The name of the map being played.
 *     tags:
 *       - mapstats
 *     responses:
 *       200:
 *         description: Match stats
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/MatchNotFound'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(400).json({ message: "Match ID Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT mtch.user_id as user_id, mtch.cancelled as cancelled, mtch.forfeit as forfeit, mtch.end_time as mtch_end_time FROM `match` mtch, map_stats mstat WHERE mstat.id = ? AND mstat.match_id = mtch.id";
    const matchRow = await db.query(currentMatchInfo, req.body[0].map_stats_id);
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
      matchRow[0].mtch_end_time != null
    ) {
      res.status(422).json({ message: "Match is already finished." });
      return;
    } else {
      await db.withTransaction(async () => {
        let mapStatId = req.body[0].map_stats_id;
          "SELECT a.user_id FROM `match` a, map_stats b WHERE b.id = ?";
        let updatedValues = {
          end_time: req.body[0].end_time,
          team1_score: req.body[0].team1_score,
          team2_score: req.body[0].team2_score,
          winner: req.body[0].winner,
          demoFile: req.body[0].demo_file,
          map_name: req.body[0].map_name,
        };
        updatedvalues = await db.buildUpdateStatement(updatedValues);
        if (Object.keys(updatedvalues).length === 0) {
          res
            .status(412)
            .json({ message: "No update data has been provided." });
          return;
        }
        let sql = "UPDATE map_stats SET ? WHERE id = ?";
        updateMapStats = await db.query(sql, [updatedValues, mapStatId]);
        if (updateMapStats.affectedRows > 0)
          res.json({ message: "Map Stats updated successfully!" });
        else
          res
            .status(401)
            .json({ message: "ERROR - Maps Stats not updated or found." });
      });
    }
  } catch (err) {
    console.log(err);
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
 *         $ref: '#/components/responses/MatchNotFound'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(400).json({ message: "Map Stats ID Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT mtch.user_id as user_id, mtch.cancelled as cancelled, mtch.forfeit as forfeit, mtch.end_time as mtch_end_time FROM `match` mtch, map_stats mstat WHERE mstat.id = ? AND mstat.match_id = mtch.id";
    const matchRow = await db.query(currentMatchInfo, req.body[0].map_stats_id);
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
      matchRow[0].mtch_end_time != null
    ) {
      res.status(422).json({ message: "Match is already finished." });
      return;
    } else {
      await db.withTransaction(async () => {
        let userProfile = req.user.id; // Brought in from steam passport.
        let mapStatsId = req.body[0].map_stats_id;
        let deleteSql = "DELETE FROM map_stats WHERE id = ?";
        const delRows = await db.query(deleteSql, [mapStatsId]);
        if (delRows.affectedRows > 0)
          res.json({ message: "Map Stats deleted successfully!" });
        else
          res
            .status(401)
            .json({ message: "ERR - Unauthorized to delete OR not found." });
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

module.exports = router;
