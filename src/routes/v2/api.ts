/** Express API router for teams in get5.
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

import db from "../../services/db.js";

/** Basic Rate limiter.
 * @const
 */
const basicRateLimit = rateLimit({
  windowMs: 30 * 30 * 1000, // 15 mins per 30k requests seems like a fair amount.
  max: 30000,
  message: "Too many requests from this IP. Please try again in 15 minutes.",
  keyGenerator: async (req) => {
    try {
      const apiKey = req.get("Authorization");
      const dbApiKey: any = await db.query(
        "SELECT api_key FROM `match` WHERE api_key = ?",
        apiKey
      );
      if (dbApiKey[0].api_key)
        return dbApiKey[0].api_key;
      else return req.ip;
    } catch (err) {
      return req.ip;
    }
  },
});

/**
 * @swagger
 *
 * /v2:
 *   post:
 *     description: Retrieves all logged calls from the game server and operates on them as needed, based on the event.
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

  if(!apiKey) {
    res.status(401).send({ message: "API key not provided." });
    return;
  }

  if (!matchId) {
    // Retrieve Match ID from the database.
    const dbMatchKey: any = await db.query(
      "SELECT id FROM `match` WHERE api_key = ?",
      apiKey
    );
    if (!dbMatchKey[0]?.id) {
      res.status(401).send({ message: "Match ID has not been provided." });
      return;
    }
    matchId = dbMatchKey[0].id;
  }
  
  
  res.status(200).send({ message: "Success" });
  return;
});
export default router;