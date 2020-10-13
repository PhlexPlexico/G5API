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
 *    SeasonData:
 *      type: object
 *      required:
 *        - server_id
 *        - name
 *        - start_date
 *      properties:
 *        server_id:
 *          type: integer
 *          description: Unique server ID.
 *        name:
 *          type: string
 *          description: The name of the Season to be created.
 *        start_date:
 *          type: string
 *          format: date-time
 *          description: Season start date.
 *        end_date:
 *          type: string
 *          format: date-time
 *          description: Optional season end date.
 *   responses:
 *     NoSeasonData:
 *       description: No season data was provided.
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
 *       200:
 *         description: All seasons within the system.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  seasons:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/SeasonData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
    res.json({seasons});
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
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  seasons:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/SeasonData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
    res.json({seasons});
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
 *         schema:
 *          type: integer
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Season stats
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  matches:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:season_id", async (req, res, next) => {
  try {
    seasonID = req.params.season_id;
    let sql = "SELECT * FROM `match` where season_id = ?";
    let seasonSql = "SELECT * FROM season WHERE season_id = ?";
    const seasons = await db.query(seasonSql, seasonID);
    const matches = await db.query(sql, seasonID);
    if (seasons.length === 0){
      res.status(404).json({message: "Season not found."});
      return;
    }
    if (matches.length === 0){
      res.status(404).json({message: "No match found in season."});
      return;
    }
    res.json({matches});
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons:
 *   post:
 *     description: Create a new season.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/SeasonData'
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: New season inserted successsfully.
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
      let insertSeason = await db.query(sql, [insertSet]);
      res.json({ message: "Season inserted successfully!", id: insertSeason.insertId });
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
 *     description: Update a season.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/SeasonData'
 *            
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: New season inserted successsfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *         $ref: '#/components/responses/NotFound'
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
