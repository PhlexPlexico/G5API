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

/** Ensures the user was authenticated through steam OAuth.
 * @function
 * @memberof module:routes/users
 * @function
 * @inner */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/auth/steam');
}

/** GET - Route serving to get all users.
 * @name router.get('/')
 * @function
 * @memberof module:routes/users
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/", async (req, res) => {
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
 * @param {number} request.param.user_id - The database or steam ID of the user.
 * @param {callback} middleware - Express middleware.
 */
router.get("/:user_id", async (req, res, next) => {
  try {
    userOrSteamID = req.params.user_id;
    let sql = "SELECT * FROM user where id = ? OR steam_id = ?";
    const allUsers = await db.query(sql, userOrSteamID);
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
router.post("/create", ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.user.super_admin === 1 || req.user.admin === 1 ){
      await db.withTransaction(db, async () => {
        let steamId = req.body[0].steam_id;
        let steamName = req.body[0].name;
        let isAdmin = req.body[0].admin;
        let isSuperAdmin = req.body[0].super_admin;
        // Check if user is allowed to create?
        let sql =
          "INSERT INTO user (steam_id, name, admin, super_admin) VALUES (?,?,?,?)";
        await db.query(sql, [steamId, steamName, isAdmin, isSuperAdmin]);
        res.json({ message: "User created successfully" });
      });
    } else {
      res.status(401).json({message: "You are not authorized to do this."});
    }
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** PUT - Route serving to update a user admin privilege in the application.
 * @name /update
 * @function
 * @memberof module:routes/users
 * @param {number} req.body[0].steam_id - Steam ID of the user being edited.
 * @param {number} [req.body[0].admin] - Integer determining if a user is an admin of the system. Either 1 or 0.
 * @param {number} [req.body[0].super_admin] - Integer determining if a user is a super admin of the system. Either 1 or 0.
 */
router.put("/update", ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.user.super_admin === 1 || req.user.admin === 1 ){
      await db.withTransaction(db, async () => {
        let steamId = req.body[0].steam_id;
        let isAdmin = req.body[0].admin || 0;
        let isSuperAdmin = req.body[0].super_admin || 0;
        let sql = "UPDATE user SET admin = ?, super_admin = ? WHERE steam_id = ?";
        await db.query(sql, [isAdmin, isSuperAdmin, steamId]);
      });
    } else {
      res.status(401).json({message: "You are not authorized to do this."});
    }
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

module.exports = router;
