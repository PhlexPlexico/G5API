/** Express API router for users in get5.
 * @module routes/users
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

/** GET - Route serving to get all game servers.
 * @name router.get('/')
 * @function
 * @memberof module:routes/mapstats
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
// TODO: Once users are taken care of, and we track which user is logged in whe need to give a different SQL string, one for public servers, one for all servers.
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM map_stats";
    const allStats = await db.query(sql);
    res.json(allStats);
  } catch (err) {
    res.status(500).json({ message: err });
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
    res.json(mapStats);
  } catch (err) {
    res.status(500).json({ message: err });
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
router.post("/create", async (req, res, next) => {
  try{
    await withTransaction(db, async () => {
      let matchId = req.body[0].match_id;
      let mapNum = req.body[0].map_number;
      let mapName = req.body[0].map_name;
      let startTime =  req.body[0].start_time;
      let sql = "INSERT INTO map_stats (match_id, map_number, map_name, start_time) VALUES (?,?,?,?)";
      await db.query(sql, [matchId, mapNum, mapName, startTime]);
      res.json("Map stats inserted successfully!");
    });
  } catch ( err ) {
    res.status(500).json({message: err})
  }
});

/** PUT - Update a map stats object when it is completed.
 * @name router.post('/update')
 * @memberof module:routes/mapstats
 * @function
 * @param {int} req.body[0].map_stats_id - The ID of the map stat being updated, for end times, score, winner, and demo files.
 * @param {DateTime} req.body[0].end_time - The Date Time that the map has ended.
 * @param {int} req.body[0].winner - The ID of the team that was victorious.
 * @param {int} req.body[0].team1_score - The score of team1 defined in the match object.
 * @param {int} req.body[0].team2_score - The score of team2 defined in the match object.
 * @param {string} req.body[0].demo_file - The demo file of the match once demo has been finished recording.
 *
*/
router.put("/update", async (req, res, next) => {
  try{
    await withTransaction(db, async () => {
      let mapStatId = req.body[0].map_stats_id;
      let endTime = req.body[0].end_time;
      let winner = req.body[0].team1_score;
      let team1Score =  req.body[0].team2_score;
      let team2Score = await encrypt(req.body[0].rcon_password);
      let demoFile = req.body[0].demo_file;
      let sql = "UPDATE map_stats SET end_time = ?, winner = ?, team1_score = ?, team2_score = ?, demoFile = ? WHERE id = ?";
      updateMapStats = await db.query(sql, [endTime, winner, team1Score, team2Score, demoFile, mapStatId]);
      if (updateMapStats.affectedRows > 0)
        res.json("Map Stats updated successfully!");
      else
        res.status(401).json({message: "ERROR - Maps Stats not updated or found."});
    });
  } catch ( err ) {
    res.status(500).json({message: err});
  }
});

/** DEL - Delete a game server in the database.
 * @name router.post('/delete')
 * @memberof module:routes/mapstats
 * @function
 * @param {int} req.body[0].user_id - The ID of the user deleteing. Can check if admin when implemented.
 * @param {int} req.body[0].map_stats_id - The ID of the map stats being removed.
 *
*/
router.delete("/delete", async (req,res,next) => {
  try {
    await withTransaction (db, async () => {
      let userId = req.body[0].user_id;
      let mapStatsId = req.body[0].map_stats_id;
      let sql = "DELETE FROM map_stats WHERE id = ?"
      const delRows = await db.query(sql, [mapStatsId]);
      if (delRows.affectedRows > 0)
        res.json("Map Stats deleted successfully!");
      else
        res.status(401).json("ERR - Unauthorized to delete OR not found.");
    });
  } catch( err ){
    console.log(err);
    res.statuss(500).json({message: err});
  }
});

/** Inner function - boilerplate transaction call.
 * @name withTransaction
 * @function
 * @inner
 * @memberof module:routes/servers
 * @param {*} db - The database object.
 * @param {*} callback - The callback function that is operated on, usually a db.query()
 */
async function withTransaction(db, callback) {
  try {
    await db.beginTransaction();
    await callback();
    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  } /* finally {
    await db.close();
  } */
}

module.exports = router;