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

/** GET - Route serving to get all users.
 * @name router.get('/')
 * @function
 * @memberof module:routes/users
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM user";
    const allUsers = await db.query(sql);
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** GET - Route serving to get one user by database or steam id.
 * @name router.get('/:userid')
 * @memberof module:routes/users
 * @function
 * @param {string} path - Express path
 * @param {number} request.param.userid - The database or steam ID of the user.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:userid", async (req, res, next) => {
  try {
    userOrSteamID = req.params.userid;
    let sql = "SELECT * FROM user where id = ? OR steam_id = ?";
    const allUsers = await db.query(sql);
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** POST - Route serving to insert a user into the database.
 * @name /create
 * @function
 * @memberof module:routes/users
 * @param {number} req.body[0].steam_id - Steam ID of the user being created.
 * @param {string} req.body[0].name - Name gathered from Steam. Can be updated.
 * @param {number} req.body[0].admin - Integer determining if a user is an admin of the system. Either 1 or 0.
 * @param {number} req.body[0].super_admin - Integer determining if a user is a super admin of the system. Either 1 or 0.
 */
router.post("/create", async (req, res, next) => {
  try {
    await withTransaction(db, async () => {
      let steamId = req.body[0].steam_id;
      let steamName = req.body[0].name;
      let isAdmin = req.body[0].admin;
      let isSuperAdmin = req.body[0].super_admin;
      let sql =
        "INSERT INTO user (steam_id, name, admin, super_admin) VALUES (?,?,?,?)";
      await db.query(sql, [steamId, steamName, isAdmin, isSuperAdmin]);
      res.json({ message: "User created successfully" });
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** PUT - Route serving to update a user admin privilege in the application.
 * @name /update
 * @function
 * @memberof module:routes/users
 * @param {number} req.body.steam_id - Steam ID of the user being created.
 * @param {number} req.body.admin - Integer determining if a user is an admin of the system. Either 1 or 0.
 * @param {number} req.body.super_admin - Integer determining if a user is a super admin of the system. Either 1 or 0.
 */
router.put("/update", async (req, res, next) => {
  try {
    await withTransaction(db, async () => {
      let steamId = req.body[0].steam_id;
      let isAdmin = req.body[0].admin || 0;
      let isSuperAdmin = req.body[0].super_admin || 0;
      let sql = "UPDATE user SET admin = ?, super_admin = ? WHERE steam_id = ?";
      await db.query(sql, [isAdmin, isSuperAdmin, steamId]);
    });
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
