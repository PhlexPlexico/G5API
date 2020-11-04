 /**
 * @swagger
 * resourcePath: /mapstats
 * description: Express API router for mapstats in get5.
 */
const express = require("express");

const router = express.Router();

const db = require("../db");

const Utils = require("../utility/utils");


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
 *                type: object
 *                properties:
 *                  type: array
 *                  mapstats:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM map_stats";
    const mapstats = await db.query(sql);
    if (mapstats.length === 0) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json({mapstats});
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
 *                type: object
 *                properties:
 *                  type: array
 *                  mapstats:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM map_stats where match_id = ?";
    const mapstats = await db.query(sql, matchID);
    if (mapstats.length === 0) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json({mapstats});
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats/:match_id/:map_id:
 *   get:
 *     description: Map statistics for a given match and map.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *          type: integer
 *       - name: map_id
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
 *                type: object
 *                properties:
 *                  type: array
 *                  mapstats:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MapStatsData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id/:map_id", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let mapID = req.params.map_id;
    let sql = "SELECT * FROM map_stats where match_id = ? AND id = ?";
    const mapstats = await db.query(sql, [matchID, mapID]);
    if (mapstats.length === 0) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    const mapstat = JSON.parse(JSON.stringify(mapstats[0]));
    res.json({mapstat});
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
  let newSingle = await db.getConnection();
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
      await db.withNewTransaction(newSingle, async () => {
        let mapStatSet = {
          match_id: req.body[0].match_id,
          map_number: req.body[0].map_number,
          map_name: req.body[0].map_name,
          start_time: req.body[0].start_time,
        };
        let sql = "INSERT INTO map_stats SET ?";
        let insertedStats = await newSingle.query(sql, [mapStatSet]);
        res.json({ message: "Map stats inserted successfully!", id: insertedStats[0].insertId });
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
  let newSingle = await db.getConnection();
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(412).json({ message: "Map stat ID Not Provided" });
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
      await db.withNewTransaction(newSingle, async () => {
        let mapStatId = req.body[0].map_stats_id;
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
        updateMapStats = await newSingle.query(sql, [updatedValues, mapStatId]);
        if (updateMapStats[0].affectedRows > 0)
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
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoMapStatData'
 *       422:
 *         $ref: '#/components/responses/MatchAlreadyFinished'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let newSingle = await db.getConnection();
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(412).json({ message: "Map Stats ID Not Provided" });
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
      await db.withNewTransaction(newSingle, async () => {
        let mapStatsId = req.body[0].map_stats_id;
        let deleteSql = "DELETE FROM map_stats WHERE id = ?";
        const delRows = await newSingle.query(deleteSql, [mapStatsId]);
        if (delRows[0].affectedRows > 0)
          res.json({ message: "Map Stats deleted successfully!" });
        else
          res
            .status(400)
            .json({ message: "ERR - Unauthorized to delete OR not found." });
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

module.exports = router;
