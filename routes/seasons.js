/** Express API router for users in get5.
 * @module routes/seasons
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

/** GET - Route serving to get all seasons.
 * @name router.get('/')
 * @function
 * @memberof module:routes/seasons
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
// TODO: Once users are taken care of, and we track which user is logged in whe need to give a different SQL string, one for all matches, one for user matches.
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `season`";
    const seasons = await db.query(sql);
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get base information of a season.
 * @name router.get('/:seasonid')
 * @memberof module:routes/seasons
 * @function
 * @param {string} path - Express path
 * @param {number} request.param.season_id - The ID of the season to retrieve basic information.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:seasonid", async (req, res, next) => {
  try {
    //
    seasonID = req.params.season_id;
    let sql = "SELECT * FROM season where id = ?";
    const seasons = await db.query(sql, seasonID);
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** POST - Create a veto object from a given match.
 * @name router.post('/create')
 * @memberof module:routes/seasons
 * @function
 * @param {int} req.body[0].user_id - The ID of the user creating the match.
 * @param {string} req.body[0].name - The name of the Season to be created.
 * @param {DateTime} req.body[0].start_date - Season start date.
 * @param {DateTime} req.body[0].end_date - Optional season end date.
 */
router.post("/create", async (req, res, next) => {
  try {
    await db.withTransaction(db, async () => {
      let insertSet = {
        user_id: req.body[0].user_id,
        name: req.body[0].name,
        start_date: req.body[0].start_date,
        end_date: req.body[0].end_date,
      };
      let sql = "INSERT INTO season SET ?";
      await db.query(sql, [insertSet]);
      res.json("Season inserted successfully!");
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** PUT - Create a veto object from a given match.
 * @name router.post('/update')
 * @memberof module:routes/seasons
 * @function
 * @param {int} req.body[0].season_id - The ID of the season being modified.
 * @param {int} req.body[0].user_id - The ID of the user modifying the season.
 * @param {string} req.body[0].name - The name of the Season to be updated.
 * @param {DateTime} req.body[0].start_date - Season start date.
 * @param {DateTime} req.body[0].end_date - Season end date.
 */
router.put("/update", async (req, res, next) => {
  try {
      await db.withTransaction(db, async () => {
      let updateStmt = {
        user_id: req.body[0].user_id,
        name: req.body[0].name,
        start_date: req.body[0].start_date,
        end_date: req.body[0].end_date,
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);
      let sql = "UPDATE season SET ? WHERE id = ?";
      await db.query(sql, [updateStmt, req.body[0].season_id]);
      res.json("Season updated successfully!");
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

/** DEL - Delete all match data associated with a match, including stats, vetoes, etc. **NOT IMPLEMENTED**
 * @name router.delete('/delete')
 * @memberof module:routes/seasons
 * @function
 * @param {int} req.body[0].user_id - The ID of the user deleteing. Can check if admin when implemented.
 * @param {int} req.body[0].match_id - The ID of the match to remove all values pertaining to the match.
 *
 */

 
router.delete("/delete", async (req, res, next) => {
  try {
    throw "NOT IMPLEMENTED";
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

module.exports = router;
