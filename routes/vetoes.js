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
const Utils = require('../utils');

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
    res.json(vetoes);
  } catch (err) {
    res.status(500).json({ message: err });
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
router.get("/:matchid", async (req, res, next) => {
  try {
    // 
    matchId = req.params.match_id;
    let sql = "SELECT * FROM veto where match_id = ?";
    const vetos = await db.query(sql, matchId);
    res.json(vetos);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** POST - Create a veto object from a given match.
 * @name router.post('/create')
 * @memberof module:routes/vetoes
 * @function
 * @param {int} req.body[0].match_id - The ID of the match.
 * @param {string} req.body[0].team_name - The team that is vetoeing.
 * @param {string} req.body[0].map_name - The current map name that was vetoed.
 * @param {string} req.body[0].pick_or_ban - Whether it was a pick or ban.
 *
*/
router.post("/create", Utils.ensureAuthenticated, async (req, res, next) => {
  try{
    let checkUserSql = "SELECT * FROM `match` WHERE id = ? AND user_id = ?";
    const checkUser = await db.query(checkUserSql, [req.body[0].match_id, req.user.id]);
    if (checkUser.length < 1 || req.user.super_admin !== 1 || req.user.admin !== 1) {
      res.status(401).json({message: "User is not authorized to perform action."});
    }
    await db.withTransaction(db, async () => {
      let matchId = req.body[0].match_id;
      let mapName = req.body[0].map_name;
      let teamName = req.body[0].team_name;
      let pickOrBan =  req.body[0].pick_or_ban;
      let sql = "INSERT INTO veto (match_id, team_name, map, pick_or_veto) VALUES (?,?,?,?)";
      await db.query(sql, [matchId, teamName, mapName, pickOrBan]);
      res.json("Veto inserted successfully!");
    });
  } catch ( err ) {
    res.status(500).json({message: err})
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
  try {
    let checkUserSql = "SELECT * FROM `match` WHERE id = ? AND user_id = ?";
    const checkUser = await db.query(checkUserSql, [req.body[0].match_id, req.user.id]);
    if (checkUser.length < 1 || req.user.super_admin !== 1 || req.user.admin !== 1) {
      res.status(401).json({message: "User is not authorized to perform action."});
    }
    await db.withTransaction (db, async () => {
      // let userId = req.body[0].user_id;
      let matchId = req.body[0].match_id;
      let sql = "DELETE FROM veto WHERE match_id = ?";
      const delRows = await db.query(sql, [matchId]);
      if (delRows.affectedRows > 0)
        res.json("Vetoes deleted successfully!");
      else
        res.status(401).json("ERR - Unauthorized to delete OR not found.");
    });
  } catch( err ){
    console.log(err);
    res.statuss(500).json({message: err});
  }
});



module.exports = router;