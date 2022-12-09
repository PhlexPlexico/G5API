/**
 * @swagger
 * resourcePath: /playerstatsextras
 * description: Express API for player additional stats in Get5 matches.
 */
 import { Router } from "express";
 import app from "../../app.js";
 
 const router = Router();
 
 import db from "../../db.js";
 
 import Utils from "../../utility/utils.js";
 
 import GlobalEmitter from "../../utility/emitter.js";

 /* Swagger shared definitions */
/**
 * @swagger
 *
 * components:
 *   schemas:
 *     PlayerStatsExtras:
 *       type: object
 *       required:
 *         - match_id
 *         - map_id
 *         - team_id
 *         - steam_id
 *         - name
 *       properties:
 *         player_stat_id:
 *           type: integer
 *           description: Integer determining which player had died in the system, the victim.
 *         match_id:
 *           type: integer
 *           description: Match identifier in the system.
 *         map_id:
 *           type: integer
 *           description: Integer determining the current map of the match.
 *         team_id:
 *           type: integer
 *           description: Integer determining the team a player is on.
 *         round_number:
 *           type: integer
 *           description: Integer determining the round that the player death occurred on.
 *         round_time:
 *           type: integer
 *           description: Integer determining the round time that the player death occurred on.
 *         player_attacker_id:
 *           type: integer
 *           description: Player identifier in the system on the given team that had killed the player that this record represents.
 *         weapon:
 *           type: string
 *           description: The name of the weapon that the player died from.
 *         bomb:
 *           type: boolean
 *           description: Whether the player died from the bomb or not.
 *         headshot:
 *           type: boolean
 *           description: Whether the player died from a headshot.
 *         thru_smoke:
 *           type: boolean
 *           description: Whether the player died thru smoke.
 *         attacker_blind:
 *           type: boolean
 *           description: Whether the player was killed by a blind attacker.
 *         no_scope:
 *           type: boolean
 *           description: Whether the player was killed by a no scope.
 *         suicide:
 *           type: boolean
 *           description: Whether the player had killed themselves via suicide.
 *         friendly_fire:
 *           type: boolean
 *           description: Whether the player had died from friendly fire.
 *         player_assister_id:
 *           type: integer
 *           description: Player identifier in the system on the given team.
 *         assist_friendly_fire:
 *           type: boolean
 *           description: Indicates if the assist was friendly fire.
 *         flash_assist:
 *           type: boolean
 *           description: Indicates if the assist was via a flashbang.
 */

/**
 * @swagger
 *
 * /playerstatsextra/extra:
 *   get:
 *     description: Route serving to get all extra player statistics.
 *     produces:
 *       - application/json
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Extra Player Stats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStatsExtras'
 *       400:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/", async (req, res, next) => {
    try {
      let sql = "SELECT * FROM player_stat_extras";
      const playerStatExtra = await db.query(sql);
      if (!playerStatExtra.length) {
        res.status(404).json({ message: "No additional stats found on the site!" });
        return;
      }
      res.json({ playerStatExtra });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.toString() });
    }
});

/**
 * @swagger
 *
 * /playerstatsextra/:steam_id:
 *   get:
 *     description: Player stats from a given Steam ID.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: steam_id
 *         required: true
 *         schema:
 *            type: string
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stats from a given user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStatsExtras'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:steam_id", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    let sql = "SELECT id FROM player_stats WHERE steam_id = ?"
    let extraSql = "SELECT * FROM player_stat_extras where id IN (?)";
    const playerIds = await db.query(sql, steamID);
    if (!playerIds.length) {
      res.status(404).json({ message: "No stats found for player " + steamID });
      return;
    }
    const extrastats = await db.query(extraSql, [playerIds]);
    if (!extrastats.length) {
      res.status(404).json({ message: "No extra stats found for player " + steamID });
      return;
    }
    res.json({ extrastats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstatsextra/:steam_id/pug:
 *   get:
 *     description: Extra player stats from a given Steam ID involved in PUGs
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: steam_id
 *         required: true
 *         schema:
 *            type: string
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stats from a given user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStatsExtras'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:steam_id/pug", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    return getIdFromMatches(steamID, 1, null, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstatsextra/:steam_id/official:
 *   get:
 *     description: Extra player stats from a given Steam ID involved in official matches.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: steam_id
 *         required: true
 *         schema:
 *            type: string
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stats from a given user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStatsExtras'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:steam_id/official", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    return getIdFromMatches(steamID, 0, null, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstatsextra/:steam_id/season/:season_id:
 *   get:
 *     description: Extra player stats from a given Steam ID involved in a speciefic season.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: steam_id
 *         required: true
 *         schema:
 *            type: string
 *       - name: season_id
 *         required: true
 *         schema:
 *            type: string
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stats from a given user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStatsExtras'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:steam_id/season/:season_id", async (req, res, next) => {
    try {
      let steamID = req.params.steam_id;
      let seasonID = req.params.season_id
      return getIdFromMatches(steamID, 0, seasonID, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.toString() });
    }
});

/**
 * @swagger
 *
 * /playerstatsextras/match/:match_id:
 *   get:
 *     description: Extra player stats from a given match in the system.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stats from a given match.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStatsExtra'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/match/:match_id", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM player_stat_extras where match_id = ?";
    const extrastats = await db.query(sql, matchID);
    if (!extrastats.length) {
      res.status(404).json({ message: "No stats found for match " + matchID });
      return;
    }
    res.json({ extrastats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** Get extra player stats standing in a season, pug or official matches.
* @function
* @memberof module:routes/playerstatsextra
* @param {string} [steamId] - Steam64 ID.
* @param {boolean} [pug] - PUGs to filter.
* @param {string} [seasonId=null] - Season ID to filter.
* @param {object} [res] - The response to send back to the client.
*/
const getIdFromMatches = async (steamId, isPug, seasonId, res) => {
    let pugSql = 
      `SELECT id
        FROM player_stats 
        WHERE steam_id = ?
        AND match_id IN (
        SELECT id FROM \`match\`
        WHERE cancelled = 0
        AND is_pug = ?
      )`;
    if (seasonId) {
      pugSql = 
      `SELECT id
      FROM player_stats 
      WHERE steam_id = ?
      AND match_id IN (
        SELECT id FROM \`match\`
        WHERE cancelled = 0
        AND season_id = ?
      )`;
    }
    let playerIds = await db.query(pugSql, [steamId, isPug, seasonId]);
    let extraSql = "SELECT * FROM player_stat_extras where id IN (?)";
    if (!playerIds.length) {
      res.status(404).json({ message: "No stats found for player " + steamId });
      return;
    }
    const extrastats = await db.query(extraSql, [playerIds]);
    if (!extrastats.length) {
      res.status(404).json({ message: "No extra stats found for player " + steamId });
      return;
    }
    res.json({ extrastats });
    return;
}

export default router;