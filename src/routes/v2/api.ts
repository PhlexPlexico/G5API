/** Express API router for game server updates in get5.
 * @module routes/v2
 * @requires express
 * @requires db
 */

/**
 * @swagger
 * resourcePath: /v2
 * description: Express API for v2 API calls in G5API.
 */

import { Router } from "express";
/** Express module
 * @const
 */
const router: Router = Router();

/** Rate limit includes.
 * @const
 */
import rateLimit from "express-rate-limit";

import { db } from "../../services/db.js";
import { RowDataPacket } from "mysql2";
import { Get5_OnEvent } from "../../types/Get5_OnEvent.js";
import SeriesFlowService from "../../services/seriesflowservices.js";
import { Get5_OnSeriesResult } from "../../types/series_flow/Get5_OnSeriesResult.js";
import { Get5_OnMapResult } from "../../types/series_flow/Get5_OnMapResult.js";
import { Get5_OnMapVetoed } from "../../types/series_flow/veto/Get5_OnMapVetoed.js";
import { Get5_OnMapPicked } from "../../types/series_flow/veto/Get5_OnMapPicked.js";
import { Get5_OnSidePicked } from "../../types/series_flow/veto/Get5_OnSidePicked.js";
import { Get5_OnBackupRestore } from "../../types/series_flow/Get5_OnBackupRestore.js";
import { Get5_OnGoingLive } from "../../types/map_flow/Get5_OnGoingLive.js";
import MapFlowService from "../../services/mapflowservices.js";
import { Get5_OnMatchPausedUnpaused } from "../../types/map_flow/Get5_OnMatchPausedUnpaused.js";
import { Get5_OnPlayerDeath } from "../../types/map_flow/Get5_OnPlayerDeath.js";
import { Get5_OnBombEvent } from "../../types/map_flow/Get5_OnBombEvent.js";
import { Get5_OnRoundStart } from "../../types/map_flow/Get5_OnRoundStart.js";
import Utils from "../../utility/utils.js";
import { Get5_OnRoundEnd } from "../../types/map_flow/Get5_OnRoundEnd.js";

/** Basic Rate limiter.
 * @const
 */
const basicRateLimit = rateLimit({
  windowMs: 30 * 30 * 1000, // 15 mins per 30k requests seems like a fair amount.
  max: 30000,
  message: "Too many requests from this IP. Please try again in 15 minutes.",
  keyGenerator: async (req) => {
    try {
      const apiKey: string | undefined = req.get("Authorization");
      const dbApiKey: RowDataPacket[] = await db.query(
        "SELECT api_key FROM `match` WHERE api_key = ?",
        [apiKey]
      );
      if (dbApiKey[0].api_key) return dbApiKey[0].api_key;
      else return req.ip;
    } catch (err) {
      return req.ip;
    }
  }
});

/**
 * @swagger
 *
 * /v2:
 *   post:
 *     description: Retrieves all logged calls from the game server and operates on them as needed, based on the event.
 *                  Please see [events and forwards](http://splewis.github.io/get5/latest/events.html#tag/All-Events/paths/Get_OnEvent/post)
 *                  From the get5 documentation to see what data is required for each event. Typings can also be found in the repository.
 *     produces:
 *       - application/json
 *     tags:
 *       - v2
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", basicRateLimit, async (req, res) => {
  let matchId: string = req.body?.matchid;
  const apiKey: string | undefined = req.get("Authorization");
  const eventType: Get5_OnEvent = req.body;

  try {
    if (!apiKey) {
      return res.status(401).send({ message: "API key not provided." });
    }

    if (!matchId) {
      // Retrieve Match ID from the database.
      const dbMatchKey: RowDataPacket[] = await db.query(
        "SELECT id FROM `match` WHERE api_key = ?",
        [apiKey]
      );
      if (!dbMatchKey[0]?.id) {
        res.status(401).send({ message: "Match ID has not been provided." });
        return;
      }
      matchId = dbMatchKey[0].id;
    }

    const matchApiCheck: number = await Utils.checkApiKey(apiKey, matchId);
    if (eventType.event == "demo_upload_ended") {
      // Ignore demo_upload_ended event.
      return res.status(200).send({message: "Success"});
    } else if (eventType.event == "series_end") {
      // let forfeit: number = event.
      // Match is finalized, this is usually called after a cancel so we just ignore the value with a 200 response.
      if (matchApiCheck == 2) {
        return res.status(200).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
      } else if (matchApiCheck == 1) {
        console.error(
          "Match already finalized or and invalid API key has been given."
        );
        return res.status(401).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
      }
    } else {
      if (matchApiCheck == 2 || matchApiCheck == 1) {
        console.error(
          "Match already finalized or and invalid API key has been given."
        );
        return res.status(401).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
      }
    }

    switch (eventType.event) {
      // Series Flows
      case "map_picked":
        SeriesFlowService.OnMapPicked(req.body as Get5_OnMapPicked, res);
        break;
      case "map_vetoed":
        SeriesFlowService.OnMapVetoed(req.body as Get5_OnMapVetoed, res);
        break;
      case "side_picked":
        SeriesFlowService.OnSidePicked(req.body as Get5_OnSidePicked, res);
        break;
      case "backup_loaded":
        SeriesFlowService.OnBackupRestore(
          req.body as Get5_OnBackupRestore,
          res
        );
        break;
      case "map_result":
        SeriesFlowService.OnMapResult(req.body as Get5_OnMapResult, res);
        break;
      case "series_end":
        SeriesFlowService.OnSeriesResult(req.body as Get5_OnSeriesResult, res);
        break;
      // Map Flows
      case "going_live":
        MapFlowService.OnGoingLive(req.body as Get5_OnGoingLive, res);
        break;
      case "round_start":
        MapFlowService.OnRoundStart(req.body as Get5_OnRoundStart, res);
        break;
      case "round_end":
        MapFlowService.OnRoundEnd(req.body as Get5_OnRoundEnd, res);
        break;
      case "player_death":
        MapFlowService.OnPlayerDeath(req.body as Get5_OnPlayerDeath, res);
        break;
      case "bomb_planted":
        MapFlowService.OnBombEvent(req.body as Get5_OnBombEvent, res, false);
        break;
      case "bomb_defused":
        MapFlowService.OnBombEvent(req.body as Get5_OnBombEvent, res, true);
        break;
      case "game_paused":
        MapFlowService.OnMatchPausedUnPaused(
          req.body as Get5_OnMatchPausedUnpaused,
          res
        );
        break;
      case "game_unpaused":
        MapFlowService.OnMatchPausedUnPaused(
          req.body as Get5_OnMatchPausedUnpaused,
          res
        );
        break;
      default:
        res.status(202).send({message: `Event ${eventType.event} is not implemented.`});
        break;
    }
    // Responses are taken care of in the case statements.
    return;
  } catch (error: unknown) {
    return;
  }
});

export { router };
