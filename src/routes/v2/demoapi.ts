/** Express API router for demo uploads in get5.
 * @module routes/v2
 * @requires express
 * @requires db
 */

/**
 * @swagger
 * resourcePath: /v2/demo
 * description: Express API for v2 API calls in G5API.
 */

/** ZIP files.
 * @const
 */
import JSZip from "jszip";

/** Required to save files.
 * @const
 */
import { existsSync, mkdirSync, writeFile } from "fs";

/** Config to check demo uploads.
 * @const
 */
import config from "config";

import { db } from "../../services/db.js";

import { Request, Response, Router } from "express";
import {} from "express";
import Utils from "../../utility/utils.js";
import { RowDataPacket } from "mysql2";

/**
 * @const
 * Global Server Sent Emitter class for real time data.
 */
import GlobalEmitter from "../../utility/emitter.js";

/** Express module
 * @const
 */
const router: Router = Router();

/**
 * @swagger
 *
 * /v2/demo:
 *   post:
 *     description: Retrieves the demos from the given match and map, zips and stores them on the server.
 *     produces:
 *       - application/json
 *     tags:
 *       - v2
 *     parameters:
 *      - in: header
 *        name: Get5-FileName
 *        description: Name of the file as defined by get5_demo_name_format
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
  if (!config.get("server.uploadDemos")) {
    res.status(403).send({ message: "Demo uploads disabled for this server." });
    return;
  }
  try {
    const apiKey: string | undefined = req.get("Authorization");
    const matchId: string | undefined = req.get("Get5-MatchId");
    const mapNumber: string | undefined = req.get("Get5-MapNumber");
    const demoFilename: string | undefined = req.get("Get5-FileName");
    // Check that the values have made it across.
    if (!apiKey || !matchId || !mapNumber || !demoFilename) {
      res
        .status(401)
        .send({ message: "API key, Match ID, or Map Number not provided." });
      return;
    }
    // Check if our API key is correct.
    const matchApiCheck: number = await Utils.checkApiKey(apiKey, matchId);
    if (matchApiCheck == 1) {
      res.status(401).send({
        message: "Invalid API key has been given."
      });
      return;
    }
    // Begin file compression into public/demos and check time variance of 8 minutes.
    let zip: JSZip = new JSZip();
    let sqlString: string =
      "SELECT id, end_time FROM map_stats WHERE match_id = ? AND map_number = ?";
    const mapInfo: RowDataPacket[] = await db.query(sqlString, [
      matchId,
      mapNumber
    ]);
    if (mapInfo.length == 0) {
      res.status(404).send({ message: "Failed to find map stats object." });
      return;
    }
    let currentDate: Date = new Date();
    let endTimeMs: Date = new Date(mapInfo[0].end_time);
    let timeDifference: number = Math.abs(
      currentDate.getTime() - endTimeMs.getTime()
    );
    let minuteDifference = Math.floor(timeDifference / 1000 / 60);
    let updateStmt: object;
    if (minuteDifference > 8) {
      res.status(401).json({ message: "Demo can no longer be uploaded." });
      return;
    }

    zip.file(demoFilename, req.body, { binary: true });
    zip
      .generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
      .then((buf) => {
        writeFile("public/demos" + demoFilename, buf, "binary", function (err) {
          if (err) {
            console.error(err);
            throw err;
          }
        });
      });
    // Update map stats object to include the link to the demo.
    updateStmt = {
      demoFile: demoFilename.replace("dem", "zip")
    };
    updateStmt = await db.buildUpdateStatement(updateStmt);

    sqlString = "UPDATE map_stats SET ? WHERE id = ?";
    await db.query(sqlString, [mapInfo[0].id]);
    GlobalEmitter.emit("demoUpdate");
    return;
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
    return;
  }
});

export { router };
