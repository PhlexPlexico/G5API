/**
 * @swagger
 * resourcePath: /maps
 * description: Express API router for map lists.
 */
import { Router } from "express";

const router = Router();

import db from "../db.js";

import Utils from "../utility/utils.js";

/* Swagger shared definitions */

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     NewMap:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: System identifier of a map.
 *         steam_id:
 *           type: string
 *           description: Foreign Key User ID.
 *         map_name:
 *           type: string
 *           description: The technical name of the map. This usually starts with de_.
 *         map_display_name:
 *           type: string
 *           description: The display name that a user wishes to show.
 *         enabled:
 *           type: boolean
 *           description: Value representing whether the map is used or not. Defaults to true,
 *         inserted_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of when a new map was inserted.
 *     Maps:
 *       allOf:
 *         - $ref: '#/components/schemas/NewMap'
 *         - type: object
 *           properties:
 *             id:
 *               type: integer
 */

/**
 * @swagger
 *
 * /maps/:
 *   get:
 *     description: Get all maps from all users.
 *     produces:
 *       - application/json
 *     tags:
 *       - maps
 *     responses:
 *       200:
 *         description: List of maps
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Maps'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res) => {
  try {
    let sql =
      "SELECT * FROM map_list";
    const maplist = await db.query(sql);
    res.json({ maplist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** @swagger
 *
 * /maps/:user_id:
 *   get:
 *     description: Get the maplist of a specific user
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database or steam ID of the user
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - maps
 *     responses:
 *       200:
 *         description: Get a maplist of a specific user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Maps'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:user_id", async (req, res, next) => {
  try {
    let sql =
      "SELECT * FROM map_list WHERE user_id = ?";
    const maplist = await db.query(sql, [req.params.user_id]);
    if (maplist[0] != null)
      res.json({ maplist });
    else
      res.status(404).json({message: "Maplist does not exist in the system for given user."});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** @swagger
 *
 * /maps/:user_id/enabled:
 *   get:
 *     description: Get the maplist of a specific user that are enabled.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: user_id
 *         description: The database or steam ID of the user
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - maps
 *     responses:
 *       200:
 *         description: Get enabled maps for a user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Maps'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:user_id/enabled", async (req, res, next) => {
  try {
    let sql =
      "SELECT * FROM map_list WHERE user_id = ? AND enabled = true";
    const maplist = await db.query(sql, [req.params.user_id]);
    if (maplist[0] != null)
      res.json({ maplist });
    else
      res.status(404).json({message: "Maplist does not exist in the system for given user."});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /maps:
 *   post:
 *     description: Create map for maplist
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewMap'
 *     tags:
 *       - maps
 *     responses:
 *       200:
 *         description: Create successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let userID = req.user.id;
    let enabled = req.body[0].enabled == null
      ? true
      : req.body[0].enabled;
    let newMapID;
    let insertSet = {
      user_id: userID,
      map_name: req.body[0].map_name,
      map_display_name: req.body[0].map_display_name,
      enabled: enabled
    }
    insertSet = await db.buildUpdateStatement(insertSet);
    // Check if user is allowed to create?
    let sql =
      "INSERT INTO map_list SET ?";
    let newMap = await db.query(sql, [insertSet]);
    newMapID = newMap.insertId;
    res.json({ message: "MapList created successfully.", id: newMapID });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /maps:
 *   put:
 *     description: Update a map in the map_list
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewMap'
 *     tags:
 *       - maps
 *     responses:
 *       200:
 *         description: Map update successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
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
  if (req.body[0].id == null) {
    res.status(412).json({message: "No map ID was provided to update."});
    return;
  }
  try {
    let userID = req.user.id;
    let mapListId = req.body[0].id;
    let enabled = req.body[0].enabled == null
      ? true
      : req.body[0].enabled;
    let insertSet = {
      map_name: req.body[0].map_name,
      map_display_name: req.body[0].map_display_name,
      enabled: enabled
    }
    insertSet = await db.buildUpdateStatement(insertSet);
    // Check if user is allowed to create?
    let sql =
      "UPDATE map_list SET ? WHERE id = ? AND user_id = ?";
    await db.query(sql, [insertSet, mapListId, userID]);
    res.json({ message: "Map updated successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /maps:
 *   delete:
 *     description: Delete a map in the map_list
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/NewMap'
 *     tags:
 *       - maps
 *     responses:
 *       200:
 *         description: Map update successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       412:
 *         description: Nothing to update
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  if (req.body[0].id == null) {
    res.status(412).json({message: "No map ID was provided to delete."});
    return;
  }
  try {
    let userID = req.user.id;
    let mapListId = req.body[0].id;
    // Check if user is allowed to create?
    let sql =
      "DELETE FROM map_list WHERE id = ? AND user_id = ?";
    await db.query(sql, [mapListId, userID]);
    res.json({ message: "Map deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

export default router;
