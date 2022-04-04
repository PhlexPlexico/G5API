/**
 * @swagger
 * resourcePath: /users
 * description: Express API router for users in get5.
 */
import { Router } from "express";

import { hashSync, compare } from "bcrypt";

const router = Router();

import db from "../db.js";

import Utils from "../utility/utils.js";

import { generate } from "randomstring";

/* Swagger shared definitions */

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     NewUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: System identifier of a user.
 *         steam_id:
 *           type: string
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
 *         new_api:
 *           type: boolean
 *           description: Whether the user is requesting a new API key.
 *         password:
 *           type: string
 *           description: A new password to reset a user.
 *         old_password:
 *           type: string
 *           description: The old password provided by the user to check validity.
 *         force_reset:
 *           type: boolean
 *           description: If a user requires a force reset/remove password, update the password to NULL. 
 *         challonge_api_key:
 *           type: string
 *           description: A [challonge API](https://challonge.com/settings/developer) key
 *     User:
 *       allOf:
 *         - $ref: '#/components/schemas/NewUser'
 *         - type: object
 *           properties:
 *             id:
 *               type: integer
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
 *                 $ref: '#/components/schemas/NewUser'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res) => {
  try {
    let sql =
      "SELECT id, name, steam_id, small_image, medium_image, large_image FROM user";
    const users = await db.query(sql);
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** @swagger
 *
 * /users/:user_id:
 *   get:
 *     description: Get specific user
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database or steam ID of the user
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Get a specific user.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  user:
 *                      $ref: '#/components/schemas/NewUser'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:user_id", async (req, res, next) => {
  try {
    let userOrSteamID = req.params.user_id;
    let sql;
    if (
      req.user != null &&
      (req.user.id == userOrSteamID || Utils.superAdminCheck(req.user))
    ) {
      sql = "SELECT * FROM user WHERE id = ? OR steam_id = ?";
    } else {
      sql =
        "SELECT id, name, steam_id, small_image, medium_image, large_image, admin, super_admin FROM user where id = ? OR steam_id = ?";
    }

    let user = await db.query(sql, [userOrSteamID, userOrSteamID]);
    if (user[0] != null) {
      user = JSON.parse(JSON.stringify(user[0]));
      if (user.api_key != null) {
        user.api_key = user?.id + ":" + Utils.decrypt(user.api_key);
      }
      if (user.challonge_api_key != null) {
        user.challonge_api_key = Utils.decrypt(user.challonge_api_key);
      }
      res.json({ user });
    } else {
      res.status(404).json({ message: "User does not exist in the system." });
    }
  } catch (err) {
    console.error(err);
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
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewUser'
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Create successful
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
    if (Utils.adminCheck(req.user)) {
      let steamId = req.body[0].steam_id;
      let steamName = req.body[0].name;
      let isAdmin = req.body[0].admin;
      let isSuperAdmin = req.body[0].super_admin;
      let smallImage = req.body[0].small_image;
      let mediumImage = req.body[0].medium_image;
      let largeImage = req.body[0].large_image;
      let challongeApiKey =
        req.body[0].challonge_api_key == null
          ? null
          : Utils.encrypt(req.body[0].challonge_api_key);
      let apiKey = generate({
        length: 64,
        capitalization: "uppercase",
      });
      let userId = null;
      apiKey = Utils.encrypt(apiKey);
      // Check if user is allowed to create?
      let sql =
        "INSERT INTO user SET ?";
      let userObject = {
        steam_id: steamId,
        name: steamName,
        admin: isAdmin,
        super_admin: isSuperAdmin,
        small_image: smallImage,
        medium_image: mediumImage,
        large_image: largeImage,
        api_key: apiKey,
        challonge_api_key: challongeApiKey
      };
      userObject = await db.buildUpdateStatement(userObject);
      let newUser = await db.query(sql, [userObject]);
      userId = newUser.insertId;
      res.json({ message: "User created successfully.", id: userId });
    } else {
      res.status(403).json({ message: "You are not authorized to do this." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /users:
 *   put:
 *     description: Update a user
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewUser'
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: User update successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
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
    let userToBeUpdated = await db.query(
      "SELECT id, name, admin, super_admin, username, password FROM user WHERE id = ? OR steam_id = ?",
      [req.body[0].id, req.body[0].steam_id]
    );
    let isAdmin =
      req.body[0].admin == null ? userToBeUpdated[0].admin : req.body[0].admin;
    let isSuperAdmin =
      req.body[0].super_admin == null
        ? userToBeUpdated[0].super_admin
        : req.body[0].super_admin;
    let displayName =
      req.body[0].name === null ? userToBeUpdated[0].name : req.body[0].name;
    let smallImage = req.body[0].small_image;
    let mediumImage = req.body[0].medium_image;
    let largeImage = req.body[0].large_image;
    let apiKey =
      req.body[0].new_api == 1
        ? generate({
          length: 64,
          capitalization: "uppercase",
        })
        : null;
    let challongeApiKey =
      req.body[0].challonge_api_key == null
        ? null
        : Utils.encrypt(req.body[0].challonge_api_key);
    let password = req.body[0].password;
    let oldPassword = req.body[0].old_password;
    if (apiKey != null) apiKey = Utils.encrypt(apiKey);
    let steamId = req.body[0].steam_id;
    let userId = userToBeUpdated[0].id;
    let updateUser = {};
    // Let admins force update passwords in the event of issues.
    if (Utils.adminCheck(req.user)) {
      updateUser = {
        admin: isAdmin,
        super_admin: isSuperAdmin,
        name: displayName,
        small_image: smallImage,
        medium_image: mediumImage,
        large_image: largeImage,
        api_key: apiKey,
        password: password ? hashSync(password, 10) : null,
        challonge_api_key: challongeApiKey
      };
    } else if (req.user.steam_id == steamId || req.user.id == userId) {
      if (req.body[0].force_reset) {
        await db.query("UPDATE user SET password = NULL WHERE steam_id = ?", req.user.steam_id);
      } else if (password && userToBeUpdated[0].password) {
        const isOldPassMatching = await compare(oldPassword, userToBeUpdated[0].password);
        if (!isOldPassMatching) {
          res.status(403).json({ message: "Old password does not match." });
          return;
        }
      }
      updateUser = {
        api_key: apiKey,
        password: userToBeUpdated[0].username == null
          ? null
          : hashSync(password, 10),
        challonge_api_key: challongeApiKey
      };
    } else {
      res.status(403).json({ message: "You are not authorized to do this." });
      return;
    }
    updateUser = await db.buildUpdateStatement(updateUser);
    if (!Object.keys(updateUser)) {
      res.status(412).json({ message: "No update data has been provided." });
      return;
    }
    let sql = "UPDATE user SET ? WHERE steam_id = ?";
    await db.query(sql, [updateUser, steamId]);
    // If we're updating ourselves we need to update their session. Force a reload of session.
    if (req.user.steam_id == req.body[0].steam_id) {
      // Check if the user being updated has admin access to begin with.
      if (Utils.adminCheck(req.user)) {
        req.user.super_admin = isSuperAdmin;
        req.user.admin = isAdmin;
        req.login(req.user, (err) => {
          if (err) return next(new Error("Error updating user profile"));
        });
      }
    }
    res.status(200).json({ message: "User successfully updated!" });
  } catch (err) {
    console.error(err);
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
 *         schema:
 *          type: integer
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Update successful
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
    let userOrSteamID = req.params.user_id;
    let sql = "SELECT steam_id FROM user where id = ? OR steam_id = ?";
    const allUsers = await db.query(sql, [userOrSteamID, userOrSteamID]);
    res.json({
      url: "https://steamcommunity.com/profiles/" + allUsers[0].steam_id,
    });
  } catch (err) {
    console.error(err);
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
 *         schema:
 *          type: integer
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Last five matches from the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */

router.get("/:user_id/recent", async (req, res, next) => {
  try {
    let userOrSteamID = req.params.user_id;
    let sql =
      "SELECT DISTINCT rec_matches.id, " +
      "rec_matches.user_id, " +
      "rec_matches.team1_id, " +
      "rec_matches.team2_id, " +
      "rec_matches.team1_string, " +
      "rec_matches.team2_string " +
      "FROM `match` rec_matches JOIN player_stats ps " +
      "ON ps.match_id = rec_matches.id JOIN user us ON " +
      "us.steam_id = ps.steam_id " +
      "WHERE (rec_matches.cancelled = 0 OR rec_matches.cancelled IS NULL) " +
      "AND (us.id=? OR us.steam_id=?) " +
      "ORDER BY rec_matches.id DESC LIMIT 5";
    const matches = await db.query(sql, [userOrSteamID, userOrSteamID]);
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

export default router;
