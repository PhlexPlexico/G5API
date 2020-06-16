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


/* Swagger shared definitions */

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     NewUser:
 *       type: object
 *       properties:
 *         steam_id:
 *           type: integer
 *           description: Steam ID of the user being created
 *         name:
 *           type: string
 *           description: Name gathered from Steam. Can be updated
 *         admin:
 *           type: integer
 *           description: Integer determining if a user is an admin of the system. Either 1 or 0.
 *         super_admin:
 *           type: integer
 *           description: Integer determining if a user is an  admin of the system. Either 1 or 0.
 *         small_image:
 *           type: string
 *           description: Akamai Steam URL to the small profile image
 *         medium_image:
 *           type: string
 *           description: Akamai Steam URL to the small profile image
 *         large_image:
 *           type: string
 *           description: Akamai Steam URL to the small profile image
 *     User:
 *       allOf:
 *         - $ref: '#/components/schemas/NewUser'
 *         - type: object
 *           properties:
 *             id:
 *               type: integer
 *     SimpleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *   responses:
 *     BadRequest:
 *       description: Match ID not provided
 *     NotFound:
 *       description: The specified resource was not founds
 *     Unauthorized:
 *       description: Unauthorized
 *     MatchNotFound:
 *       description: Match not founds
 *     Error:
 *       description: Error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */


/**
 * @swagger
 *
 * /users/:
 *   get:
 *     description: Get all users
 *     produces:
 *       - application/json
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *               $ref: '#/components/schemas/User'
 *       500:
 *         $ref: '#/components/responses/Error'
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


/** @swagger
 *
 * /users/:user_id:
 *   get:
 *     description: Get spesific user
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database or steam ID of the user
 *         required: true
 *         type: string
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Update successfull
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       500:
 *         $ref: '#/components/responses/Error'
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

/**
 * @swagger
 *
 * /users:
 *   post:
 *     description: Create user
 *     produces:
 *       - application/json
 *     requestBody:
 *      description: Optional description in *Markdown*
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewUser'
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Create successfull
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
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
      res.status(403).json({ message: "You are not authorized to do this." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.toString() });
  }
});



 /**
 * @swagger
 *
 * /users:
 *   put:
 *     description: Create user
 *     produces:
 *       - application/json
 *     requestBody:
 *      description: Optional description in *Markdown*
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewUser'
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: User
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               schema:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       412:
 *         description: Nothing to update
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
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
      res.status(403).json({ message: "You are not authorized to do this." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.toString() });
  }
});



/** @swagger
 *
 * /users/:user_id/steam:
 *   get:
 *     description:  get a users' steam URL
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database or steam ID of the user
 *         required: true
 *         type: string
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Update successfull
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *       500:
 *         $ref: '#/components/responses/Error'
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

 /** @swagger
 *
 * /users/:user_id/recent:
 *   get:
 *     description: Get a users' recent matches
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database or steam ID of the user
 *         required: true
 *         type: string
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Update successfull
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *       500:
 *         $ref: '#/components/responses/Error'
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
