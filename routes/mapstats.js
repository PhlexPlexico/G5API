/** Express API router for users in get5.
 * @module routes/mapstats
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

/** Utility class for various methods used throughout.
 * @const */
const Utils = require("../utility/utils");

/** GET - Route serving to get all game servers.
 * @name router.get('/')
 * @function
 * @memberof module:routes/mapstats
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
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

/** GET - Route serving to get a set of map stats from a match.
 * @name router.get('/:match_id')
 * @memberof module:routes/mapstats
 * @function
 * @param {string} path - Express path
 * @param {number} request.param.match_id - The ID of the match containing the statistics.
 * @param {callback} middleware - Express middleware.
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

/** POST - Create a map stat object from a given match.
 * @name router.post('/create')
 * @memberof module:routes/mapstats
 * @function
 * @param {int} req.body[0].match_id - The ID of the match.
 * @param {int} req.body[0].map_number - The current map number the series is on.
 * @param {string} req.body[0].map_name - The current map name.
 * @param {DateTime} req.body[0].start_time - The start time, as DateTime.
 *
 */
router.post("/create", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].match_id == null) {
      res.status(404).json({ message: "Match ID Not Provided" });
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
        .status(401)
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

/** PUT - Update a map stats object when it is completed.
 * @name router.put('/update')
 * @memberof module:routes/mapstats
 * @function
 * @param {int} req.body[0].map_stats_id - The ID of the map stat being updated, for end times, score, winner, and demo files.
 * @param {DateTime} [req.body[0].end_time] - The Date Time that the map has ended.
 * @param {int} [req.body[0].winner] - The ID of the team that was victorious.
 * @param {int} [req.body[0].team1_score] - The score of team1 defined in the match object.
 * @param {int} [req.body[0].team2_score] - The score of team2 defined in the match object.
 * @param {string} [req.body[0].map_name] - The map the stats are recording from in the match series.
 * @param {string} [req.body[0].demo_file] - The demo file of the match once demo has been finished recording.
 *
 */
router.put("/update", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(404).json({ message: "Match ID Not Provided" });
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
        .status(401)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].mtch_end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      await db.withTransaction(async () => {
        let mapStatId = req.body[0].map_stats_id;
        let userProfile = req.user.id;
        let matchQuery =
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

/** DEL - Delete a game server in the database.
 * @name router.delete('/delete')
 * @memberof module:routes/mapstats
 * @function
 * @param {int} req.body[0].map_stats_id - The ID of the map stats being removed.
 *
 */
router.delete("/delete", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.body[0].map_stats_id == null) {
      res.status(404).json({ message: "Map Stats ID Not Provided" });
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
        .status(401)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].mtch_end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
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
