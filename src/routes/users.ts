/**
 * @swagger
 * resourcePath: /users
 * description: Express API router for users in get5.
 */
import { Router } from "express";

import { hashSync, compare } from "bcrypt";

const router = Router();

import {db} from "../services/db.js";

import Utils from "../utility/utils.js";

import { generate } from "randomstring";
import { RowDataPacket } from "mysql2";
import { UserObject } from "../types/users/UserObject.js";
import { ROLES, createUser, resolveSteam64, UserCreationError } from "../utility/userCreation.js";
import { Toornament } from "../services/toornament.js";

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
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NewUser'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res) => {
  try {
    let sql: string =
      "SELECT id, name, steam_id, small_image, medium_image, large_image FROM user";
    const users: RowDataPacket[] = await db.query(sql);
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/**
 * @swagger
 *
 * /users/roles:
 *   get:
 *     description: List every user with their role. Super admins only.
 *     produces:
 *       - application/json
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: List of users with their roles
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/roles", Utils.ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || !Utils.superAdminCheck(req.user)) {
      res.status(403).json({ message: "You are not authorized to do this." });
      return;
    }
    const users: RowDataPacket[] = await db.query(
      "SELECT id, name, steam_id, small_image, admin, super_admin FROM user ORDER BY super_admin DESC, admin DESC, name ASC"
    );
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/**
 * @swagger
 *
 * /users/new:
 *   post:
 *     description: Create a user with a given role. Super admins only.
 *     tags:
 *       - users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               steam_id:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, admin, super_admin]
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created
 *       400:
 *         description: Invalid input
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Steam ID or username already exists
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/new", Utils.ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || !Utils.superAdminCheck(req.user)) {
      res.status(403).json({ message: "You are not authorized to do this." });
      return;
    }
    const { steam_id, name, role, username, password } = req.body ?? {};
    if (!Object.prototype.hasOwnProperty.call(ROLES, role)) {
      res.status(400).json({ message: "Invalid role." });
      return;
    }
    const steamId = await resolveSteam64(steam_id);
    if (!steamId) {
      res.status(400).json({ message: "Not a valid Steam ID." });
      return;
    }
    if (!!username !== !!password) {
      res.status(400).json({ message: "Username and password must be provided together." });
      return;
    }
    const id = await createUser({ steamId, role, name, username, password });
    res.json({ message: "User created successfully.", id });
  } catch (err) {
    if (err instanceof UserCreationError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/**
 * @swagger
 *
 * /users/:user_id:
 *   delete:
 *     description: Delete a user. Super admins only. Their servers and seasons are deleted, their matches and teams are kept without an owner.
 *     tags:
 *       - users
 *     parameters:
 *       - name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 *       400:
 *         description: You cannot delete yourself or the last super admin
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/:user_id", Utils.ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || !Utils.superAdminCheck(req.user)) {
      res.status(403).json({ message: "You are not authorized to do this." });
      return;
    }
    const target: RowDataPacket[] = await db.query(
      "SELECT id, super_admin FROM user WHERE id = ?",
      [req.params.user_id]
    );
    if (target.length === 0) {
      res.status(404).json({ message: "User does not exist in the system." });
      return;
    }
    if (target[0].id === req.user.id) {
      res.status(400).json({ message: "You cannot delete your own account." });
      return;
    }
    if (target[0].super_admin === 1) {
      const remaining: RowDataPacket[] = await db.query(
        "SELECT id FROM user WHERE super_admin = 1 AND id != ?",
        [target[0].id]
      );
      if (remaining.length === 0) {
        res.status(400).json({ message: "The last super admin cannot be deleted." });
        return;
      }
    }
    await db.query("DELETE FROM map_list WHERE user_id = ?", [target[0].id]);
    await db.query("DELETE FROM dathost_config WHERE user_id = ?", [target[0].id]);
    await db.query("DELETE FROM user WHERE id = ?", [target[0].id]);
    res.json({ message: "User successfully deleted!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/**
 * @swagger
 *
 * /users/:user_id/role:
 *   put:
 *     description: Change the role of a user. Super admins only.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database ID of the user
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin, super_admin]
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         description: Role updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         description: Invalid role or the last super admin cannot be demoted
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/:user_id/role", Utils.ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || !Utils.superAdminCheck(req.user)) {
      res.status(403).json({ message: "You are not authorized to do this." });
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(ROLES, req.body?.role)) {
      res.status(400).json({ message: "Invalid role." });
      return;
    }
    const newRole = ROLES[req.body.role as keyof typeof ROLES];
    const target: RowDataPacket[] = await db.query(
      "SELECT id, super_admin FROM user WHERE id = ?",
      [req.params.user_id]
    );
    if (target.length === 0) {
      res.status(404).json({ message: "User does not exist in the system." });
      return;
    }
    if (target[0].super_admin === 1 && newRole.super_admin === 0) {
      const remaining: RowDataPacket[] = await db.query(
        "SELECT id FROM user WHERE super_admin = 1 AND id != ?",
        [target[0].id]
      );
      if (remaining.length === 0) {
        res.status(400).json({ message: "The last super admin cannot be demoted." });
        return;
      }
    }
    await db.query("UPDATE user SET ? WHERE id = ?", [newRole, target[0].id]);
    res.json({ message: "Role successfully updated!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
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
    let userOrSteamID: string = req.params.user_id;
    let sql: string;
    if (
      req.user != null &&
      (req.user.id as string | number == userOrSteamID || Utils.superAdminCheck(req.user))
    ) {
      sql = "SELECT * FROM user WHERE id = ? OR steam_id = ?";
    } else {
      sql =
        "SELECT id, name, steam_id, small_image, medium_image, large_image, admin, super_admin FROM user where id = ? OR steam_id = ?";
    }

    let user: any = await db.query(sql, [userOrSteamID, userOrSteamID]);
    if (user[0] != null) {
      user = JSON.parse(JSON.stringify(user[0]));
      if (user.api_key != null) {
        user.api_key = user?.id + ":" + Utils.decrypt(user.api_key);
      }
      if (user.challonge_api_key != null) {
        user.challonge_api_key = Utils.decrypt(user.challonge_api_key);
      }
      if ("toornament_client_secret" in user) {
        user.toornament_api_key = user.toornament_api_key
          ? Utils.decrypt(user.toornament_api_key)
          : null;
        user.toornament_client_id = user.toornament_client_id
          ? Utils.decrypt(user.toornament_client_id)
          : null;
        // The secret is write-only: only expose whether one is stored.
        user.toornament_has_secret = Boolean(user.toornament_client_secret);
        delete user.toornament_client_secret;
      }
      res.json({ user });
    } else {
      res.status(404).json({ message: "User does not exist in the system." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
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
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/NewUser'
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
    if (req.user && Utils.adminCheck(req.user)) {
      let steamId: string = req.body[0].steam_id;
      let steamName: string = req.body[0].name;
      // Only super admins may grant roles.
      let isAdmin: number = Utils.superAdminCheck(req.user) ? req.body[0].admin : 0;
      let isSuperAdmin: number = Utils.superAdminCheck(req.user) ? req.body[0].super_admin : 0;
      let smallImage: string = req.body[0].small_image;
      let mediumImage: string = req.body[0].medium_image;
      let largeImage: string = req.body[0].large_image;
      let challongeApiKey: string | null | undefined =
        req.body[0].challonge_api_key == null
          ? null
          : Utils.encrypt(req.body[0].challonge_api_key);
      let apiKey: string | undefined = generate({
        length: 64,
        capitalization: "uppercase",
      });
      let userId = null;
      apiKey = Utils.encrypt(apiKey);
      // Check if user is allowed to create?
      let sql: string =
        "INSERT INTO user SET ?";
      let userObject: UserObject = {
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
      userObject = await db.buildUpdateStatement(userObject) as UserObject;
      let newUser: RowDataPacket[] = await db.query(sql, [userObject]);
      //@ts-ignore
      userId = newUser.insertId;
      res.json({ message: "User created successfully.", id: userId });
    } else {
      res.status(403).json({ message: "You are not authorized to do this." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
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
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/NewUser'
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
    let userToBeUpdated: RowDataPacket[] = await db.query(
      "SELECT id, name, admin, super_admin, username, password FROM user WHERE id = ? OR steam_id = ?",
      [req.body[0].id, req.body[0].steam_id]
    );
    // Roles can only be changed through /users/:user_id/role by super admins.
    let isAdmin: number = userToBeUpdated[0].admin;
    let isSuperAdmin: number = userToBeUpdated[0].super_admin;
    let displayName: string =
      req.body[0].name === null ? userToBeUpdated[0].name : req.body[0].name;
    let smallImage: string = req.body[0].small_image;
    let mediumImage: string = req.body[0].medium_image;
    let largeImage: string = req.body[0].large_image;
    let apiKey: string | null | undefined =
      req.body[0].new_api == 1
        ? generate({
          length: 64,
          capitalization: "uppercase",
        })
        : null;
    let challongeApiKey: string | undefined | null =
      req.body[0].challonge_api_key == null
        ? null
        : Utils.encrypt(req.body[0].challonge_api_key);
    let password: string = req.body[0].password;
    let oldPassword: string = req.body[0].old_password;
    if (apiKey != null) apiKey = Utils.encrypt(apiKey);
    let steamId: string = req.body[0].steam_id;
    let userId: number = userToBeUpdated[0].id;
    let updateUser: UserObject;
    // Let admins force update passwords in the event of issues.
    if (req.user && Utils.adminCheck(req.user)) {
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
    } else if (req.user && req.user.steam_id == steamId || req.user!.id == userId) {
      if (req.body[0].force_reset) {
        await db.query("UPDATE user SET password = NULL WHERE steam_id = ?", [req.user?.steam_id]);
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
    let sql: string = "UPDATE user SET ? WHERE steam_id = ?";
    await db.query(sql, [updateUser, steamId]);
    // If we're updating ourselves we need to update their session. Force a reload of session.
    if (req.user && req.user.steam_id == req.body[0].steam_id) {
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
    res.status(500).json({ message: (err as Error).toString() });
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
    let userOrSteamID: string | number = req.params.user_id;
    let sql: string = "SELECT steam_id FROM user where id = ? OR steam_id = ?";
    const allUsers: RowDataPacket[] = await db.query(sql, [userOrSteamID, userOrSteamID]);
    res.json({
      url: "https://steamcommunity.com/profiles/" + allUsers[0].steam_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
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
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */

router.get("/:user_id/recent", async (req, res, next) => {
  try {
    let userOrSteamID: string | number = req.params.user_id;
    let sql: string =
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
    const matches: RowDataPacket[] = await db.query(sql, [userOrSteamID, userOrSteamID]);
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/** Resolves the user whose Toornament credentials may be managed by the requester.
 * Users manage their own credentials; super admins may manage anyone's.
 */
const getToornamentTarget = async (
  req: any,
  res: any
): Promise<number | null> => {
  const rows: RowDataPacket[] = await db.query(
    "SELECT id FROM user WHERE id = ? OR steam_id = ?",
    [req.params.user_id, req.params.user_id]
  );
  if (!rows[0]) {
    res.status(404).json({ message: "User does not exist in the system." });
    return null;
  }
  if (rows[0].id != req.user?.id && !Utils.superAdminCheck(req.user)) {
    res.status(403).json({ message: "You are not authorized to do this." });
    return null;
  }
  return rows[0].id;
};

/**
 * @swagger
 *
 * /users/{user_id}/toornament:
 *   put:
 *     description: Set the Toornament application credentials of a user. Omitted fields are left unchanged, empty values clear them. The client secret is never returned by the API.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         required: true
 *         schema:
 *          type: string
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              api_key:
 *                type: string
 *              client_id:
 *                type: string
 *              client_secret:
 *                type: string
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/:user_id/toornament", Utils.ensureAuthenticated, Utils.ensureAdmin, async (req, res) => {
  try {
    const userId: number | null = await getToornamentTarget(req, res);
    if (userId === null) return;
    const body = (Array.isArray(req.body) ? req.body[0] : req.body) ?? {};
    const fields: Record<string, string> = {
      api_key: "toornament_api_key",
      client_id: "toornament_client_id",
      client_secret: "toornament_client_secret"
    };
    const update: Record<string, string | null> = {};
    for (const [key, column] of Object.entries(fields)) {
      if (body[key] === undefined) continue;
      const value: string = body[key] == null ? "" : String(body[key]).trim();
      update[column] = value ? Utils.encrypt(value)! : null;
    }
    if (!Object.keys(update).length) {
      res.status(412).json({ message: "No update data has been provided." });
      return;
    }
    await db.query("UPDATE user SET ? WHERE id = ?", [update, userId]);
    res.json({ message: "Toornament credentials updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/**
 * @swagger
 *
 * /users/{user_id}/toornament/test:
 *   post:
 *     description: Checks that the stored Toornament credentials of a user can obtain an access token.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         required: true
 *         schema:
 *          type: string
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/:user_id/toornament/test", Utils.ensureAuthenticated, Utils.ensureAdmin, async (req, res) => {
  try {
    const userId: number | null = await getToornamentTarget(req, res);
    if (userId === null) return;
    const toornament: Toornament = await Toornament.forUser(userId);
    await toornament.testCredentials();
    res.json({ message: "Toornament credentials are valid." });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

const THEMES: string[] = ["system", "light", "dark"];

/**
 * @swagger
 *
 * /users/{user_id}/preferences:
 *   put:
 *     description: Update the display preferences of a user. Users may only update their own preferences, super admins anyone's.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         required: true
 *         schema:
 *          type: string
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              theme:
 *                type: string
 *                enum: [system, light, dark]
 *     tags:
 *       - users
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:user_id/preferences", Utils.ensureAuthenticated, async (req, res) => {
  try {
    const body = (Array.isArray(req.body) ? req.body[0] : req.body) ?? {};
    if (!THEMES.includes(body.theme)) {
      res.status(400).json({ message: `theme must be one of: ${THEMES.join(", ")}.` });
      return;
    }
    const rows: RowDataPacket[] = await db.query(
      "SELECT id FROM user WHERE id = ? OR steam_id = ?",
      [req.params.user_id, req.params.user_id]
    );
    if (!rows[0]) {
      res.status(404).json({ message: "User does not exist in the system." });
      return;
    }
    if (rows[0].id != req.user!.id && !Utils.superAdminCheck(req.user!)) {
      res.status(403).json({ message: "You are not authorized to do this." });
      return;
    }
    await db.query("UPDATE user SET theme = ? WHERE id = ?", [body.theme, rows[0].id]);
    res.json({ message: "Preferences updated successfully.", theme: body.theme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

export default router;
