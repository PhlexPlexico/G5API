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
 * @memberof module:routes/users
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM game_server";
    const allUsers = await db.query(sql);
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get one game server by database id.
 * @name router.get('/:serverid')
 * @memberof module:routes/servers
 * @function
 * @param {string} path - Express path
 * @param {number} request.param.serverid - The ID of the game server.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:serverid", async (req, res, next) => {
  try {
    serverID = req.params.userid;
    let sql = "SELECT * FROM game_server where id = ?";
    const allUsers = await db.query(sql, serverID);
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** Inner function - boilerplate transaction call.
 * @name withTransaction
 * @function
 * @inner
 * @memberof module:routes/teams
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
  } finally {
    await db.close();
  }
}

module.exports = router;