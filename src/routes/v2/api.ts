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
 *             text/plain:
 *                schema:
 *                  type: string
 *       401:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", basicRateLimit, async (req, res) => {
  let matchId: string = req.body?.matchId;
  const apiKey: string | undefined = req.get("Authorization");
  const eventType: Get5_OnEvent = req.body;

  try {
    console.log(req.body);
    if (!apiKey) {
      res.status(401).send({ message: "API key not provided." });
      return;
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

    switch (eventType.event) {
      // Series Flows
      case "map_picked":
        SeriesFlowService.OnMapPicked(
          apiKey,
          req.body as Get5_OnMapPicked,
          res
        );
      case "map_vetoed":
        SeriesFlowService.OnMapVetoed(
          apiKey,
          req.body as Get5_OnMapVetoed,
          res
        );
      case "side_picked":
        SeriesFlowService.OnSidePicked(
          apiKey,
          req.body as Get5_OnSidePicked,
          res
        );
      case "backup_loaded":
        SeriesFlowService.OnBackupRestore(
          apiKey,
          req.body as Get5_OnBackupRestore,
          res
        );
      case "map_result":
        SeriesFlowService.OnMapResult(
          apiKey,
          req.body as Get5_OnMapResult,
          res
        );
      case "series_end":
        SeriesFlowService.OnSeriesResult(
          apiKey,
          req.body as Get5_OnSeriesResult,
          res
        );
      // Map Flows
      case "going_live":
        MapFlowService.OnGoingLive(apiKey, req.body as Get5_OnGoingLive, res);
      case "round_start":
        MapFlowService.OnRoundStart(apiKey, req.body as Get5_OnRoundStart, res);
      case "player_death":
        MapFlowService.OnPlayerDeath(
          apiKey,
          req.body as Get5_OnPlayerDeath,
          res
        );
      case "bomb_planted":
        MapFlowService.OnBombEvent(
          apiKey,
          req.body as Get5_OnBombEvent,
          res,
          false
        );
      case "bomb_defused":
        MapFlowService.OnBombEvent(
          apiKey,
          req.body as Get5_OnBombEvent,
          res,
          true
        );
      case "game_paused":
        MapFlowService.OnMatchPausedUnPaused(
          apiKey,
          req.body as Get5_OnMatchPausedUnpaused,
          res
        );
      case "game_unpaused":
        MapFlowService.OnMatchPausedUnPaused(
          apiKey,
          req.body as Get5_OnMatchPausedUnpaused,
          res
        );
    }
    // Responses are taken care of in the case statements.
    return;
  } catch (error: unknown) {
    return;
  }
});

export { router };
