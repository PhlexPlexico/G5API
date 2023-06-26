/** Express API router for remote backup uploads in get5.
 * @module routes/v2/demo
 * @requires express
 * @requires db
 */

/**
 * @swagger
 * resourcePath: /v2/demo
 * description: Express API for v2 API calls in G5API.
 */

/** Config to check demo uploads.
 * @const
 */
import config from "config";

import { db } from "../../services/db.js";

import { Request, Response, Router } from "express";
import Utils from "../../utility/utils.js";
import { RowDataPacket } from "mysql2";

/**
 * @const
 * Global Server Sent Emitter class for real time data.
 */
import { existsSync, mkdirSync, writeFile } from "fs";

/** Express module
 * @const
 */
const router: Router = Router();

/**
 * @swagger
 *
 * /v2/backup:
 *   post:
 *     description: Retrieves the backups from the game servers and stores them in the application.
 *     produces:
 *       - application/json
 *     tags:
 *       - v2
 *     parameters:
 *      - in: header
 *        name: Get5-FileName
 *        description: Name of the backup file coming from the game server.
 *        schema:
 *          type: string
 *        required: true
 *      - in: header
 *        name: Get5-MapNumber
 *        description: Zero-indexed map number in the series.
 *        schema:
 *          type: string
 *        required: true
 *      - in: header
 *        name: Get5-RoundNumber
 *        description: Zero-indexed map number in the series, if the match is not live it is -1.
 *        schema:
 *          type: string
 *        required: true
 *      - in: header
 *        name: Authorization
 *        description: The API key provided by the server.
 *        schema:
 *          type: string
 *        required: true
 *      - in: header
 *        name: Get5-MatchId
 *        description: The ID of the match.
 *        schema:
 *          type: string
 *        required: true
 *     requestBody:
 *       content:
 *         application/octet-stream:
 *           schema:
 *             format: binary
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const apiKey: string | undefined = req.get("Authorization");
    const matchId: string | undefined = req.get("Get5-MatchId");
    const mapNumber: string | undefined = req.get("Get5-MapNumber");
    const roundNumber: string | undefined = req.get("Get5-RoundNumber");
    // Check that the values have made it across.
    if (!apiKey || !matchId || !mapNumber || !roundNumber) {
      res.status(401).send({
        message: "API key, Match ID, Map Number, or Round Number not provided."
      });
      return;
    }
    // Check if our API key is correct.
    const matchApiCheck: number = await Utils.checkApiKey(apiKey, matchId);
    if (matchApiCheck == 1 || matchApiCheck == 2) {
      res.status(401).send({
        message: "Invalid API key has been given."
      });
      return;
    }
    if (!existsSync(`public/backups/${matchId}/`))
      mkdirSync(`public/backups/${matchId}/`, { recursive: true });

    writeFile(
      `public/backups/${matchId}/get5_backup_match${matchId}_map${mapNumber}_round${roundNumber}.cfg`,
      req.body,
      function (err) {
        if (err) {
          console.error(err);
          throw err;
        }
      }
    );
    res.status(200).send({ message: "Success" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
    return;
  }
});
export { router };
