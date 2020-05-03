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

/** Utility class for various methods used throughout.
* @const */
const Utils = require('../utility/utils');

/** GET - Route serving to get all seasons.
 * @name router.get('/')
 * @function
 * @memberof module:routes/seasons
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `season`";
    const seasons = await db.query(sql);
    if (seasons.length === 0) {
      res.status(404).json({ message: "No seasons found." });
      return;
    }
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get all seasons.
 * @name router.get('/myseasons')
 * @function
 * @memberof module:routes/seasons
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
router.get("/myseasons", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `season` WHERE user_id = ?";
    const seasons = await db.query(sql, [req.user.id]);
    if (seasons.length === 0) {
      res.status(404).json({ message: "No seasons found." });
      return;
    }
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
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
router.get("/:season_id", async (req, res, next) => {
  try {
    seasonID = req.params.season_id;
    let sql = "SELECT * FROM season where id = ?";
    const seasons = await db.query(sql, seasonID);
    if (seasons.length === 0){
      res.status(404).json({message: "No season found."});
      return;
    }
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** POST - Create a veto object from a given match.
 * @name router.post('/create')
 * @memberof module:routes/seasons
 * @function
 * @param {string} req.body[0].name - The name of the Season to be created.
 * @param {DateTime} req.body[0].start_date - Season start date.
 * @param {DateTime} [req.body[0].end_date] - Optional season end date.
 */
router.post("/create", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    await db.withTransaction(db, async () => {
      let insertSet = {
        user_id: req.user.id,
        name: req.body[0].name,
        start_date: req.body[0].start_date,
        end_date: req.body[0].end_date,
      };
      let sql = "INSERT INTO season SET ?";
      await db.query(sql, [insertSet]);
      res.json({ message: "Season inserted successfully!" });
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** PUT - Update a season with the given parameters. 
 * @name router.put('/update')
 * @memberof module:routes/seasons
 * @function
 * @param {int} req.body[0].season_id - The ID of the season being modified.
 * @param {int} [req.body[0].user_id] - The ID of the user to give the season to.
 * @param {string} [req.body[0].name] - The name of the Season to be updated.
 * @param {DateTime} [req.body[0].start_date] - Season start date.
 * @param {DateTime} [req.body[0].end_date] - Season end date.
 */
router.put("/update", Utils.ensureAuthenticated, async (req, res, next) => {
  let seasonUserId = "SELECT user_id FROM season WHERE id = ?";
  if(req.body[0].season_id == null){
    res.status(404).json({ message: "No season found." })
    return;
  }
  const seasonRow = await db.query(seasonUserId, req.body[0].season_id);
  if (seasonRow.length === 0) {
    res.status(404).json({ message: "No season found." });
    return;
  } else if (
    seasonRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(401)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
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
          if(Object.keys(updateStmt).length === 0){
            res.status(412).json({message: "No update data has been provided."});
            return;
          }
          let sql = "UPDATE season SET ? WHERE id = ?";
          await db.query(sql, [updateStmt, req.body[0].season_id]);
          res.json({ message: "Season updated successfully!" });
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: err.toString() });
    }
  }
});

/** DEL - Delete all season data associated with a given ID. The user must own the season, OR they must be a super admin.
 * This will NULL out all season data on matches that are associated with it.
 * @name router.delete('/delete')
 * @memberof module:routes/seasons
 * @function
 * @param {int} req.user.id - The ID of the user deleteing.
 * @param {int} req.body[0].season_id - The ID of the match to remove all values pertaining to the season.
 *
 */
router.delete("/delete", async (req, res, next) => {
  let seasonUserId = "SELECT user_id FROM season WHERE id = ?";
  const seasonRow = await db.query(seasonUserId, req.body[0].season_id);
  if (seasonRow.length === 0) {
    res.status(404).json({ message: "No season found." });
    return;
  } else if (
    seasonRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(401)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction(db, async () => {
        let deleteSql = "DELETE FROM season WHERE id = ?";
        let deleteStmt = {
          id: req.body[0].season_id
        };
        deleteStmt = await db.buildUpdateStatement(deleteStmt);
        await db.query(deleteSql, [deleteStmt, req.body[0].season_id]);
        res.json({ message: "Season deleted successfully!" });
    });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
});

module.exports = router;
