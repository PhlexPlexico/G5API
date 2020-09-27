/**
 * @swagger
 * resourcePath: /vetoes
 * description: Express API router for vetoes in get5.
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
 *     VetoData:
 *       type: object
 *       properties:
 *         veto_id:
 *           type: integer
 *           description: Unique ID of a veto
 *         match_id:
 *           type: integer
 *           description: Foreign key of match associated with vetoes.
 *         team_name:
 *           type: string
 *           description: The name of the team.
 *         map:
 *           type: string
 *           description: The map being picked or banned.
 *         pick_or_veto:
 *           type: string
 *           description: The choice of either pick or ban.
 * 
 *   responses:
 *     NoVetoData:
 *       description: No veto data was provided.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /vetoes/:
 *   get:
 *     description: Get all veto data from the application.
 *     produces:
 *       - application/json
 *     tags:
 *       - vetoes
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                    $ref: '#/components/schemas/VetoData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM veto";
    const vetoes = await db.query(sql);
    if (vetoes.length === 0) {
      res.status(404).json({ message: "No vetoes found." });
      return;
    }
    res.json(vetoes);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});


/**
 * @swagger
 *
 * /vetoes/:match_id:
 *   get:
 *     description: Get all veto data from a specified match.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - vetoes
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                    $ref: '#/components/schemas/VetoData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    matchId = req.params.match_id;
    let sql = "SELECT * FROM veto where match_id = ?";
    const vetoes = await db.query(sql, matchId);
    if (vetoes.length === 0) {
      res.status(404).json({ message: "No vetoes found." });
      return;
    }
    res.json(vetoes);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /vetoes:
 *   post:
 *     description: Updates an existing server.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/VetoData'
 *     tags:
 *       - vetoes
 *     responses:
 *       200:
 *         description: Veto added successfully.
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
 *         $ref: '#/components/responses/NoVetoData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
  const matchRow = await db.query(matchUserId, req.body[0].match_id);
  if (matchRow.length === 0) {
    res.status(404).json({ message: "No match found." });
    return;
  } else if (
    matchRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction(async () => {
        let insertStmt = {
          match_id: req.body[0].match_id,
          map: req.body[0].map_name,
          team_name: req.body[0].team_name,
          pick_or_veto: req.body[0].pick_or_ban
        }
        insertStmt = await db.buildUpdateStatement(insertStmt);
        if(Object.keys(insertStmt).length === 0){
          res.status(412).json({message: "No insert data has been provided."});
          return;
        }
        let sql = "INSERT INTO veto SET ?";
        await db.query(sql, [insertStmt]);
        res.json({ message: "Veto inserted successfully!" });
      });
    } catch ( err ) {
      res.status(500).json({ message: err.toString() })
    }
  }
});


/** DEL - Delete all vetoes associated with a match.
 * @name router.delete('/delete')
 * @memberof module:routes/vetoes
 * @function
 * @param {number} req.body[0].user_id - The ID of the user deleteing. Can check if admin when implemented.
 * @param {number} req.body[0].match_id - The ID of the match for vetoes to remove.
 *
*/
/**
 * @swagger
 *
 * /vetoes:
 *   delete:
 *     description: Deletes vetoes associated with a match.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              match_id:
 *                type: integer
 *                description: Match ID
 *                required: true
 *     tags:
 *       - vetoes
 *     responses:
 *       200:
 *         description: Veto deleted successfully.
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
 *         $ref: '#/components/responses/NoVetoData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req,res,next) => {
  let matchUserId = "SELECT user_id FROM `match` WHERE id = ?";
  const matchRow = await db.query(matchUserId, req.body[0].match_id);
  if (matchRow.length === 0) {
    res.status(404).json({ message: "No match found." });
    return;
  } else if (
    matchRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction (async () => {
        let matchId = req.body[0].match_id;
        let sql = "DELETE FROM veto WHERE match_id = ?";
        const delRows = await db.query(sql, [matchId]);
        if (delRows.affectedRows > 0)
          res.json({ message: "Vetoes deleted successfully!" });
        else
          res.status(412).json({ message: "Vetoes were not found, nothing to delete." });
        return;
      });
    } catch( err ){
      console.log(err);
      res.statuss(500).json({message: err});
    }
  }
});



module.exports = router;