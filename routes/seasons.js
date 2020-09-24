 /**
 * @swagger
 * resourcePath: /seasons
 * description: Express API router for seasons in get5.
 */


const express = require("express");

const router = express.Router();

const db = require("../db");

const Utils = require('../utility/utils');


/**
 * @swagger
 *
 * components:
 *   schemas:
 *     SimpleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *   responses:
 *     BadRequest:
 *       description: Season ID not provided
 *     NotFound:
 *       description: The specified resource was not found.
 *     Unauthorized:
 *       description: Unauthorized.
 *     NoSeasonData:
 *       description: No season data was provided.
 *     SeasonNotFound:
 *       description: Season was not found.
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
 * /seasons/:
 *   get:
 *     description: Get all seasons from the application.
 *     produces:
 *       - application/json
 *     tags:
 *       - seasons
 *     responses:
 *       404:
 *         $ref: '#/components/responses/SeasonsNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `season`";
    const seasons = await db.query(sql);
    if (seasons.length === 0) {
      res.status(404).json({ message: "No seasons found." });
      return;
    }
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons/myseasons:
 *   get:
 *     description: Set of seasons from the logged in user.
 *     produces:
 *       - application/json
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Seasons of logged in user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/SeasonsNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/myseasons", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql = "SELECT * FROM `season` WHERE user_id = ?";
    const seasons = await db.query(sql, [req.user.id]);
    if (seasons.length === 0) {
      res.status(404).json({ message: "No seasons found." });
      return;
    }
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});


/**
 * @swagger
 *
 * /seasons/:season_id:
 *   get:
 *     description: Set of matches from a season.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: season_id
 *         required: true
 *         type: integer
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Season stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/SeasonNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:season_id", async (req, res, next) => {
  try {
    seasonID = req.params.season_id;
    let sql = "SELECT * FROM season where id = ?";
    const seasons = await db.query(sql, seasonID);
    if (seasons.length === 0){
      res.status(404).json({message: "No season found."});
      return;
    }
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /mapstats:
 *   post:
 *     description: Add map stats for a match
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              name:
 *                type: string
 *                description: The name of the Season to be created.
 *                required: true
 *            start_date:
 *                type: dateTime
 *                description: Season start date.
 *                required: true
 *            end_date:
 *                type: dateTime
 *                description: Optional season end date.
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Seasons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    await db.withTransaction(async () => {
      let insertSet = {
        user_id: req.user.id,
        name: req.body[0].name,
        start_date: req.body[0].start_date,
        end_date: req.body[0].end_date,
      };
      let sql = "INSERT INTO season SET ?";
      await db.query(sql, [insertSet]);
      res.json({ message: "Season inserted successfully!" });
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons:
 *   put:
 *     description: Update a map stats object when it is completed
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - season_id
 *            properties:
 *              season_id:
 *                type: integer
 *              name:
 *                type: string
 *                description: The name of the Season to be created.
 *              start_date:
 *                type: dateTime
 *                description: Season start date.
 *              end_date:
 *                type: dateTime
 *                description: Optional season end date.
 *              user_id: 
 *                type: integer
 *                description: Optional user ID to swap the seasons ownership.
 *            
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Match stats
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/SeasonNotFound'
 *       412:
 *         $ref: '#/components/responses/NoSeasonData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let seasonUserId = "SELECT user_id FROM season WHERE id = ?";
  if(req.body[0].season_id == null){
    res.status(404).json({ message: "No season found." })
    return;
  }
  const seasonRow = await db.query(seasonUserId, req.body[0].season_id);
  if (seasonRow.length === 0) {
    res.status(404).json({ message: "No season found." });
    return;
  } else if (
    seasonRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
        await db.withTransaction(async () => {
          let updateStmt = {
            user_id: req.body[0].user_id,
            name: req.body[0].name,
            start_date: req.body[0].start_date,
            end_date: req.body[0].end_date,
          };
          // Remove any values that may not be updated.
          updateStmt = await db.buildUpdateStatement(updateStmt);
          if(Object.keys(updateStmt).length === 0){
            res.status(412).json({message: "No update data has been provided."});
            return;
          }
          let sql = "UPDATE season SET ? WHERE id = ?";
          await db.query(sql, [updateStmt, req.body[0].season_id]);
          res.json({ message: "Season updated successfully!" });
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: err.toString() });
    }
  }
});


/**
 * @swagger
 *
 * /seasons:
 *   delete:
 *     description: Delete a season object. NULLs any linked matches to the season as well.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              season_id:
 *                type: integer
 *                required: true
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Season deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/SeasonNotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", async (req, res, next) => {
  let seasonUserId = "SELECT user_id FROM season WHERE id = ?";
  const seasonRow = await db.query(seasonUserId, req.body[0].season_id);
  if (seasonRow.length === 0) {
    res.status(404).json({ message: "No season found." });
    return;
  } else if (
    seasonRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction( async () => {
        let deleteSql = "DELETE FROM season WHERE id = ?";
        let deleteStmt = {
          id: req.body[0].season_id
        };
        deleteStmt = await db.buildUpdateStatement(deleteStmt);
        await db.query(deleteSql, [deleteStmt, req.body[0].season_id]);
        res.json({ message: "Season deleted successfully!" });
    });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
});

module.exports = router;
