/** Express API router for users in get5.
 * @module routes/vetoes
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

/** GET - Route serving to get all vetoes.
 * @name router.get('/')
 * @function
 * @memberof module:routes/vetoes
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM veto";
    const vetoes = await db.query(sql);
    if (vetoes.length === 0) {
      res.status(404).json({ message: "No vetoes found." });
      return;
    }
    res.json(vetoes);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get all vetoes of a match.
 * @name router.get('/:matchid')
 * @memberof module:routes/vetoes
 * @function
 * @param {string} path - Express path
 * @param {number} request.param.match_id - The ID of the match containing the statistics.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    matchId = req.params.match_id;
    let sql = "SELECT * FROM veto where match_id = ?";
    const vetoes = await db.query(sql, matchId);
    if (vetoes.length === 0) {
      res.status(404).json({ message: "No vetoes found." });
      return;
    }
    res.json(vetoes);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** POST - Create a veto object from a given match.
 * @name router.post('/create')
 * @memberof module:routes/vetoes
 * @function
 * @param {int} req.body[0].match_id - The ID of the match.
 * @param {string} req.body[0].team_name - The name of the team that is vetoeing.
 * @param {string} req.body[0].map_name - The current map name that was vetoed or picked.
 * @param {string} req.body[0].pick_or_ban - Whether it was a pick or ban.
 *
*/
router.post("/create", Utils.ensureAuthenticated, async (req, res, next) => {
  let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
  const matchRow = await db.query(matchUserId, req.body[0].match_id);
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
  } else {
    try {
      await db.withTransaction(async () => {
        let insertStmt = {
          match_id: req.body[0].match_id,
          map: req.body[0].map_name,
          team_name: req.body[0].team_name,
          pick_or_veto: req.body[0].pick_or_ban
        }
        insertStmt = await db.buildUpdateStatement(insertStmt);
        if(Object.keys(insertStmt).length === 0){
          res.status(412).json({message: "No insert data has been provided."});
          return;
        }
        let sql = "INSERT INTO veto SET ?";
        await db.query(sql, [insertStmt]);
        res.json({ message: "Veto inserted successfully!" });
      });
    } catch ( err ) {
      res.status(500).json({ message: err.toString() })
    }
  }
});


/** DEL - Delete all vetoes associated with a match.
 * @name router.delete('/delete')
 * @memberof module:routes/vetoes
 * @function
 * @param {int} req.body[0].user_id - The ID of the user deleteing. Can check if admin when implemented.
 * @param {int} req.body[0].match_id - The ID of the match for vetoes to remove.
 *
*/
router.delete("/delete", Utils.ensureAuthenticated, async (req,res,next) => {
  let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
  const matchRow = await db.query(matchUserId, req.body[0].match_id);
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
  } else {
    try {
      await db.withTransaction (async () => {
        let matchId = req.body[0].match_id;
        let sql = "DELETE FROM veto WHERE match_id = ?";
        const delRows = await db.query(sql, [matchId]);
        if (delRows.affectedRows > 0)
          res.json({ message: "Vetoes deleted successfully!" });
        else
          res.status(412).json({ message: "Vetoes were not found, nothing to delete." });
        return;
      });
    } catch( err ){
      console.log(err);
      res.statuss(500).json({message: err});
    }
  }
});



module.exports = router;