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

/** Utility class for various methods used throughout.
* @const */
const Utils = require('../utility/utils');

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
    res.status(500).json({ message: err.toString() });
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
    const allUsers = await db.query(sql, [userOrSteamID,userOrSteamID]);
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** POST - Route serving to insert a user into the database.
 * @name router.post('/create')
 * @function
 * @memberof module:routes/users
 * @param {number} req.body[0].steam_id - Steam ID of the user being created.
 * @param {string} req.body[0].name - Name gathered from Steam. Can be updated.
 * @param {number} req.body[0].admin - Integer determining if a user is an admin of the system. Either 1 or 0.
 * @param {number} req.body[0].super_admin - Integer determining if a user is a super admin of the system. Either 1 or 0.
 * @param {string} [req.body[0].small_image] - Akamai Steam URL to the small profile image.
 * @param {string} [req.body[0].medium_image] - Akamai Steam URL to the medium profile image.
 * @param {string} [req.body[0].large_image] - Akamai Steam URL to the large profile image.
 */
router.post("/create", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (req.user.super_admin === 1 || req.user.admin === 1) {
      await db.withTransaction(async () => {
        let steamId = req.body[0].steam_id;
        let steamName = req.body[0].name;
        let isAdmin = req.body[0].admin;
        let isSuperAdmin = req.body[0].super_admin;
        let smallImage = req.body[0].small_image;
        let mediunImage = req.body[0].medium_image;
        let largeImage = req.body[0].large_image;
        // Check if user is allowed to create?
        let sql =
          "INSERT INTO user (steam_id, name, admin, super_admin, small_image, medium_image, large_image) VALUES (?,?,?,?,?,?,?)";
        await db.query(sql, [steamId, steamName, isAdmin, isSuperAdmin, smallImage, mediunImage, largeImage]);
        res.json({ message: "User created successfully" });
      });
    } else {
      res.status(401).json({ message: "You are not authorized to do this." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** PUT - Route serving to update a user admin privilege in the application.
 * @name router.put('/update')
 * @function
 * @memberof module:routes/users
 * @param {number} req.body[0].steam_id - Steam ID of the user being edited.
 * @param {number} [req.body[0].admin] - Integer determining if a user is an admin of the system. Either 1 or 0.
 * @param {number} [req.body[0].super_admin] - Integer determining if a user is a super admin of the system. Either 1 or 0.
 * @param {String} [req.body[0].name] - Display name of the user being updated.
 * @param {string} [req.body[0].small_image] - Akamai Steam URL to the small profile image.
 * @param {string} [req.body[0].medium_image] - Akamai Steam URL to the medium profile image.
 * @param {string} [req.body[0].large_image] - Akamai Steam URL to the large profile image.
 */
router.put("/update", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let userToBeUpdated = await db.query("SELECT name, admin, super_admin FROM user WHERE id = ?", [req.body[0].steam_id]);
    let isAdmin = req.body[0].admin === null ? userToBeUpdated[0].admin : req.body[0].admin;
    let isSuperAdmin = req.body[0].super_admin === null ? userToBeUpdated[0].super_admin : req.body[0].super_admin;
    let displayName = req.body[0].name === null ? getCurUsername[0].name : req.body[0].name;
    let smallImage = req.body[0].small_image;
    let mediumImage = req.body[0].medium_image;
    let largeImage = req.body[0].large_image;
    if (req.user.super_admin === 1 || req.user.admin === 1) {
      let steamId = req.body[0].steam_id;
      await db.withTransaction(async () => {
        let updateUser = {
          admin: isAdmin,
          super_admin: isSuperAdmin,
          name: displayName,
          small_image: smallImage,
          medium_image: mediumImage,
          large_image: largeImage
        };
        updateUser = await db.buildUpdateStatement(updateUser);
        if(Object.keys(updateUser).length === 0){
          res.status(412).json({message: "No update data has been provided."});
          return;
        }
        let sql =
          "UPDATE user SET ? WHERE steam_id = ?";
        await db.query(sql, [updateUser, steamId]);
      });
      // If we're updating ourselves we need to update their session. Force a reload of session.
      if(req.user.steam_id == req.body[0].steam_id) {
        req.user.super_admin = isSuperAdmin;
        req.user.admin = isAdmin;
        req.login(req.user, (err) => {
          if (err) return next(new Error('Error updating user profile'));
        });
      }
      res.status(200).json({message: "User successfully updated!"});
    } else {
      res.status(401).json({ message: "You are not authorized to do this." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get a users' steam URL.
 * @name router.get('/:user_id/steam')
 * @function
 * @memberof module:routes/users
 * @param {number} req.params.user_id - Steam ID or user ID of the user being edited.
 */
router.get("/:user_id/steam", async (req, res, next) => {
  try {
    userOrSteamID = req.params.user_id;
    let sql = "SELECT steam_id FROM user where id = ? OR steam_id = ?";
    const allUsers = await db.query(sql, [userOrSteamID,userOrSteamID]);
    res.json({url: "https://steamcommunity.com/profiles/"+allUsers[0].steam_id});
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get a users' recent matches.
 * @name router.get('/:user_id/recent')
 * @function
 * @memberof module:routes/users
 * @param {number} req.params.user_id - Steam ID or user ID of the user being edited.
 */
router.get("/:user_id/recent", async (req, res, next) => {
  try {
    userOrSteamID = req.params.user_id;
    let sql = "SELECT rec_matches.* FROM user u, `match` rec_matches WHERE u.id = ? OR u.steam_id = ? LIMIT 5";
    const recentMatches = await db.query(sql, [userOrSteamID, userOrSteamID]);
    res.json(recentMatches);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

module.exports = router;
