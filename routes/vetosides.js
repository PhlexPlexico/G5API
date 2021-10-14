/**
 * @swagger
 * resourcePath: /vetosides
 * description: Express API router for veto sides in get5.
 */
 const express = require("express");

 const router = express.Router();
 
 const db = require("../db");
 
 const Utils = require("../utility/utils");
 
 /**
  * @swagger
  *
  * components:
  *   schemas:
  *     VetoSideData:
  *       type: object
  *       properties:
  *         veto_side_id:
  *           type: integer
  *           description: Unique ID of a veto side.
  *         match_id:
  *           type: integer
  *           description: Foreign key of match associated with vetoes.
  *         team_name:
  *           type: string
  *           description: The name of the team.
  *         map:
  *           type: string
  *           description: The map being picked or banned.
  *         side:
  *           type: string
  *           description: The choice of either CT, T, or none.
  *
  *   responses:
  *     NoVetoSideData:
  *       description: No veto sides data was provided.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  */
 
 /**
  * @swagger
  *
  * /vetoside/:
  *   get:
  *     description: Get all veto side selection data from the application.
  *     produces:
  *       - application/json
  *     tags:
  *       - vetosides
  *     responses:
  *       200:
  *         description: All match vetoes within the system.
  *         content:
  *           application/json:
  *             schema:
  *                type: object
  *                properties:
  *                  type: array
  *                  vetoes:
  *                    type: array
  *                    items:
  *                      $ref: '#/components/schemas/VetoSideData'
  *       404:
  *         $ref: '#/components/responses/NotFound'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/", async (req, res, next) => {
   try {
     let sql = "SELECT * FROM veto_side";
     const vetoes = await db.query(sql);
     if (vetoes.length === 0) {
       res.status(404).json({ message: "No vetoe side data found." });
       return;
     }
     res.json({ vetoes });
   } catch (err) {
     res.status(500).json({ message: err.toString() });
   }
 });
 
 /**
  * @swagger
  *
  * /vetosides/:match_id:
  *   get:
  *     description: Get all veto side selection data from a specified match.
  *     produces:
  *       - application/json
  *     parameters:
  *       - name: match_id
  *         required: true
  *         schema:
  *            type: integer
  *     tags:
  *       - vetosides
  *     responses:
  *       200:
  *         description: All matches within the system.
  *         content:
  *           application/json:
  *             schema:
  *                type: object
  *                properties:
  *                  type: array
  *                  vetoes:
  *                    type: array
  *                    items:
  *                      $ref: '#/components/schemas/VetoSideData'
  *       404:
  *         $ref: '#/components/responses/NotFound'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/:match_id", async (req, res, next) => {
   try {
     matchId = req.params.match_id;
     let sql = "SELECT * FROM veto_side where match_id = ?";
     const vetoes = await db.query(sql, matchId);
     if (vetoes.length === 0) {
       res.status(404).json({ message: "No vetoe side data found." });
       return;
     }
     res.json({ vetoes });
   } catch (err) {
     res.status(500).json({ message: err.toString() });
   }
 });
 
 /**
  * @swagger
  *
  * /vetosides:
  *   post:
  *     description: Inserts veto side data for a live match.
  *     produces:
  *       - application/json
  *     requestBody:
  *      required: true
  *      content:
  *        application/json:
  *          schema:
  *            type: array
  *            items:
  *              $ref: '#/components/schemas/VetoSideData'
  *     tags:
  *       - vetosides
  *     responses:
  *       200:
  *         description: Veto side data added successfully.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                message:
  *                  type: string
  *                  description: Success message.
  *                id:
  *                  type: integer
  *                  description: The inserted veto side.
  *       400:
  *         $ref: '#/components/responses/BadRequest'
  *       403:
  *         $ref: '#/components/responses/Unauthorized'
  *       404:
  *         $ref: '#/components/responses/NotFound'
  *       412:
  *         $ref: '#/components/responses/NoVetoSideData'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
  router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
    let errMessage = await Utils.getUserMatchAccessNoFinalize(
      req.body[0].match_id,
      req.user);
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      try {
        // Get the veto ID.
        let sql = "SELECT id FROM veto WHERE match_id = ? AND team_name = ? AND map = ?";
        const vetoID = await db.query(sql, [req.body[0].match_id, req.body[0].team_name, req.body[0].map_name]);
        let insertStmt = {
          match_id: req.body[0].match_id,
          veto_id: vetoID[0].id,
          map: req.body[0].map_name,
          team_name: req.body[0].team_name,
          side: req.body[0].side,
        };
        insertStmt = await db.buildUpdateStatement(insertStmt);
        if (Object.keys(insertStmt).length === 0) {
          res
            .status(412)
            .json({ message: "No insert data has been provided." });
          return;
        }
        sql = "INSERT INTO veto_side SET ?";
        const vetoSideId = await db.query(sql, [insertStmt]);
        res.json({
          message: "Veto side selection inserted successfully!",
          id: vetoSideId.insertId,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
      }
    } 
  });
 
 /**
  * @swagger
  *
  * /vetosides:
  *   put:
  *     description: Updates an existing veto side selection.
  *     produces:
  *       - application/json
  *     requestBody:
  *      required: true
  *      content:
  *        application/json:
  *          schema:
  *            type: array
  *            items:
  *              $ref: '#/components/schemas/VetoSideData'
  *     tags:
  *       - vetosides
  *     responses:
  *       200:
  *         description: Veto side data updated successfully.
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
  *         $ref: '#/components/responses/NoVetoSideData'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
  router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
    let vetoId;
    let errMessage = await Utils.getUserMatchAccessNoFinalize(
      req.body[0].match_id,
      req.user);
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      vetoId = req.body[0].veto_id;
      try {
        let updateStmt = {
          match_id: req.body[0].match_id,
          map: req.body[0].map_name,
          team_name: req.body[0].team_name,
          side: req.body[0].side,
        };
        updateStmt = await db.buildUpdateStatement(updateStmt);
        if (Object.keys(updateStmt).length === 0) {
          res
            .status(412)
            .json({ message: "No update data has been provided." });
          return;
        }
        let sql = "UPDATE veto_side SET ? WHERE id = ?";
        await db.query(sql, [updateStmt, vetoId]);
        res.json({ message: "Veto updated successfully!" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
      }
    }
  });
 
 /**
  * @swagger
  *
  * /vetoside:
  *   delete:
  *     description: Deletes veto sides associated with a match.
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
  *       - vetoside
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
  *         $ref: '#/components/responses/NoVetoSideData'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
  router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
    let errMessage = await Utils.getUserMatchAccessNoFinalize(
      req.body[0].match_id,
      req.user);
    if (errMessage != null) {
      res.status(errMessage.status).json({ message: errMessage.message });
      return;
    } else {
      try {
        let matchId = req.body[0].match_id;
        let sql = "DELETE FROM veto_side WHERE match_id = ?";
        const delRows = await db.query(sql, [matchId]);
        if (delRows.affectedRows > 0)
          res.json({ message: "Vetoe side data deleted successfully!" });
        else
          res
            .status(412)
            .json({ message: "Veto side data were not found, nothing to delete." });
        return;
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: err });
      }
    }
  });
 
 module.exports = router;
 