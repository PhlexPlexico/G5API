/**
 * @swagger
 * resourcePath: /vetoes
 * description: Express API router for vetoes in get5.
 */
import { Router } from "express";

const router = Router();

import {db} from "../services/db.js";

import Utils from "../utility/utils.js";

import GlobalEmitter from "../utility/emitter.js";
import { RowDataPacket } from "mysql2";
import { AccessMessage } from "../types/mapstats/AccessMessage.js";
import { VetoObject } from "../types/vetoes/VetoObject.js";

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
 *         description: All match vetoes within the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vetoes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VetoData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql: string = "SELECT * FROM veto";
    const vetoes: RowDataPacket[] = await db.query(sql);
    if (!vetoes.length) {
      res.status(404).json({ message: "No vetoes found." });
      return;
    }
    res.json({ vetoes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
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
 *         description: All vetoes from a given match.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vetoes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VetoData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:match_id", async (req, res, next) => {
  try {
    let matchId: number = parseInt(req.params.match_id);
    let sql: string = "SELECT * FROM veto where match_id = ?";
    const vetoes: RowDataPacket[] = await db.query(sql, [matchId]);
    if (!vetoes.length) {
      res.status(404).json({ message: "No vetoes found." });
      return;
    }
    res.json({ vetoes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).toString() });
  }
});

/**
* @swagger
*
* /vetoes/:match_id/stream:
*   get:
*     description: Get all veto pick/ban data from a specified match, via an emitter for real-time updates.
*     produces:
*       - text/event-stream
*     parameters:
*       - name: match_id
*         required: true
*         schema:
*            type: integer
*     tags:
*       - vetosides
*     responses:
*       200:
*         description: Veto data from a given match.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/VetoData'
*       404:
*         $ref: '#/components/responses/NotFound'
*       500:
*         $ref: '#/components/responses/Error'
*/
router.get("/:match_id/stream", async (req, res, next) => {
  try {
    let matchId: number = parseInt(req.params.match_id);
    let sql: string = "SELECT * FROM veto where match_id = ?";
    let vetoes: RowDataPacket[] = await db.query(sql, [matchId]);

    res.set({
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    vetoes = vetoes.map(v => Object.assign({}, v));
    let vetoEventString: string = `event: vetodata\ndata: ${JSON.stringify(vetoes)}\n\n`

    // Need to name the function in order to remove it!
    const vetoStreamData: (() => Promise<void>) = async () => {
      vetoes = await db.query(sql, [matchId]);
      vetoes = vetoes.map(v => Object.assign({}, v));
      vetoEventString = `event: vetodata\ndata: ${JSON.stringify(vetoes)}\n\n`
      res.write(vetoEventString);
    };

    GlobalEmitter.on("vetoUpdate", vetoStreamData);
    res.write(vetoEventString);

    req.on("close", () => {
      GlobalEmitter.removeListener("vetoUpdate", vetoStreamData);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("vetoUpdate", vetoStreamData);
      res.end();
    });
  } catch (err) {
    console.log(err);
    res.status(500).write(`event: error\ndata: ${(err as Error).toString()}\n\n`)
    res.end();
  }
});

/**
 * @swagger
 *
 * /vetoes:
 *   post:
 *     description: Insert a new veto for a match.
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
 *               type: object
 *               properties:
 *                message:
 *                  type: string
 *                  description: Success message.
 *                id:
 *                  type: integer
 *                  description: The inserted veto.
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
  let errMessage: AccessMessage | null = await Utils.getUserMatchAccessNoFinalize(
    req.body[0].match_id,
    req.user!,
    false
  );
  if (errMessage != null) {
    res.status(errMessage.status).json({ message: errMessage.message });
    return;
  } else {
    try {
      let insertStmt: VetoObject  = {
        match_id: req.body[0].match_id,
        map: req.body[0].map_name,
        team_name: req.body[0].team_name,
        pick_or_veto: req.body[0].pick_or_ban,
      };
      insertStmt = await db.buildUpdateStatement(insertStmt) as VetoObject;
      if (!Object.keys(insertStmt)) {
        res
          .status(412)
          .json({ message: "No insert data has been provided." });
        return;
      }
      let sql: string = "INSERT INTO veto SET ?";
      const vetoId: RowDataPacket[] = await db.query(sql, [insertStmt]);
      res.json({
        message: "Veto inserted successfully!",
        //@ts-ignore
        id: vetoId.insertId,
      });
      GlobalEmitter.emit("vetoUpdate");
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: (err as Error).toString() });
    }
  }
});

/**
 * @swagger
 *
 * /vetoes:
 *   put:
 *     description: Updates an existing veto.
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
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let vetoId: number;
  let errMessage: AccessMessage | null = await Utils.getUserMatchAccessNoFinalize(
    req.body[0].match_id,
    req.user!,
    false
  );
  if (errMessage != null) {
    res.status(errMessage.status).json({ message: errMessage.message });
    return;
  } else {
    vetoId = req.body[0].veto_id;
    try {
      let updateStmt: VetoObject = {
        match_id: req.body[0].match_id,
        map: req.body[0].map_name,
        team_name: req.body[0].team_name,
        pick_or_veto: req.body[0].pick_or_ban,
      };
      updateStmt = await db.buildUpdateStatement(updateStmt) as VetoObject;
      if (!Object.keys(updateStmt)) {
        res
          .status(412)
          .json({ message: "No update data has been provided." });
        return;
      }
      let sql: string = "UPDATE veto SET ? WHERE id = ?";
      await db.query(sql, [updateStmt, vetoId]);
      GlobalEmitter.emit("vetoUpdate");
      res.json({ message: "Veto updated successfully!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: (err as Error).toString() });
    }
  }
});

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
 *            type: array
 *            items:
 *              type: object
 *              properties:
 *                match_id:
 *                  type: integer
 *                  description: Match ID
 *                  required: true
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
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let errMessage: AccessMessage | null = await Utils.getUserMatchAccessNoFinalize(
    req.body[0].match_id,
    req.user!,
    false
  );
  if (errMessage != null) {
    res.status(errMessage.status).json({ message: errMessage.message });
    return;
  } else {
    try {
      let matchId: number = req.body[0].match_id;
      let sql: string = "DELETE FROM veto WHERE match_id = ?";
      const delRows: RowDataPacket[] = await db.query(sql, [matchId]);
      //@ts-ignore
      if (delRows.affectedRows > 0) {
        GlobalEmitter.emit("vetoUpdate");
        res.json({ message: "Vetoes deleted successfully!" });
      }
      else
        res
          .status(412)
          .json({ message: "Vetoes were not found, nothing to delete." });
      return;
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err });
    }
  }
});

export default router;
