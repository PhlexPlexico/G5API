/**
 * @swagger
 * resourcePath: /playerstatsextras
 * description: Express API for player additional stats in Get5 matches.
 */
 import { Router } from "express";
 
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
 *         player_steam_id:
 *           type: string
 *           description: The Steam64 identifier of the player killed.
 *         player_name:
 *           type: string
 *           description: The name of the player being killed on the server.
 *         player_side:
 *           type: string
 *           description: The side the player killed is on.
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
 *         attacker_steam_id:
 *           type: string
 *           description: The Steam64 identifier of the player who attacked the player who had died.
 *         attacker_name:
 *           type: string
 *           description: The name of the player attacking the killed player on the server.
 *         attacker_side:
 *           type: string
 *           description: The side the attacker is on.
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
 *         assister_steam_id:
 *           type: string
 *           description: The Steam64 identifier of the player who assisted the attacker.
 *         assister_name:
 *           type: string
 *           description: The name of the player assisting the attacker on the server.
 *         assister_side:
 *           type: string
 *           description: The side that the assister is on. If no assister, this is null.
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
      res.status(404).json({ message: "No extra stats found for match " + matchID });
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
 * /playerstatsextras/match/:match_id/stream:
 *   get:
 *     description: Extra player stats from a given match in the system represented by a text-stream for real time updates.
 *     produces:
 *       - text/event-stream
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
 router.get("/match/:match_id/stream", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM player_stat_extras where match_id = ?";
    let playerstats = await db.query(sql, matchID);

    res.set({
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    playerstats = playerstats.map(v => Object.assign({}, v));
    let playerString = `event: playerstatextras\ndata: ${JSON.stringify(playerstats)}\n\n`
    
    // Need to name the function in order to remove it!
    const playerStreamStats = async () => {
      playerstats = await db.query(sql, matchID);
      playerstats = playerstats.map(v => Object.assign({}, v));
      playerString = `event: playerstatextras\ndata: ${JSON.stringify(playerstats)}\n\n`
      res.write(playerString);
    };

    GlobalEmitter.on("playerStatsExtraUpdate", playerStreamStats);

    res.write(playerString);
    req.on("close", () => {
      GlobalEmitter.removeListener("playerStatsExtraUpdate", playerStreamStats);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("playerStatsExtraUpdate", playerStreamStats);
      res.end();
    });
  } catch (err) {
    console.error(err.toString());
    res.status(500).write(`event: error\ndata: ${err.toString()}\n\n`)
    res.end();
  }
});

/**
 * @swagger
 *
 * /playerstatsextras:
 *   post:
 *     description: Create extra player stats in a match/map.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/PlayerStatsExtra'
 *            api_key:
 *              type: string
 *              description: API key of the match being updated.
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player Stats created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoPlayerStatData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (
      req.body[0].match_id == null ||
      req.body[0].map_id == null ||
      req.body[0].team_id == null ||
      req.body[0].steam_id == null ||
      req.body[0].name == null ||
      req.body[0].api_key == null
    ) {
      res.status(412).json({ message: "Required Data Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT mtch.user_id as user_id, mtch.cancelled as cancelled, mtch.forfeit as forfeit, mtch.end_time as mtch_end_time, mtch.api_key as mtch_api_key FROM `match` mtch WHERE mtch.id=?";
    const matchRow = await db.query(currentMatchInfo, req.body[0].match_id);
    if (!matchRow.length) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      matchRow[0].mtch_api_key != req.body[0].api_key &&
      !Utils.superAdminCheck(req.user)
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].mtch_end_time != null
    ) {
      res.status(403).json({
        message:
          "Match is already finished. Cannot insert into historical matches.",
      });
      return;
    } else {
      let insertSet = {
        player_steam_id: req.body[0].steam_id,
        player_name: req.body[0].player_name,
        player_side: req.body[0].player_side,
        map_id: req.body[0].map_id,
        match_id: req.body[0].match_id,
        team_id: req.body[0].team_id,
        round_number: req.body[0].round_number,
        round_time: req.body[0].round_time,
        attacker_steam_id: req.body[0].attacker_steam_id,
        attacker_name: req.body[0].attacker_name,
        attacker_side: req.body[0].attacker_side,
        weapon: req.body[0].weapon,
        bomb: req.body[0].bomb,
        deaths: req.body[0].deaths,
        headshot: req.body[0].headshot,
        thru_smoke: req.body[0].thru_smoke,
        attacker_blind: req.body[0].attacker_blind,
        no_scope: req.body[0].no_scope,
        suicide: req.body[0].suicide,
        friendly_fire: req.body[0].friendly_fire,
        assister_steam_id: req.body[0].assister_steam_id,
        assister_name: req.body[0].assister_name,
        assister_side: req.body[0].assister_side,
        assist_friendly_fire: req.body[0].assist_friendly_fire,
        flash_assist: req.body[0].flash_assist
      };
      let sql = "INSERT INTO player_stat_extras SET ?";
      // Remove any values that may not be inserted off the hop.
      insertSet = await db.buildUpdateStatement(insertSet);
      let insertPlayStats = await db.query(sql, [insertSet]);
      GlobalEmitter.emit("playerStatsExtraUpdate");
      res.json({
        message: "Extra Player Stats inserted successfully!",
        id: insertPlayStats.insertId,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstatsextras:
 *   put:
 *     description: Update additional player stats in a match/map.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/PlayerStatsExtra'
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Update successful.
 *         content:
 *           application/json:
 *             type: object
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *        $ref: '#/components/responses/Unauthorized'
 *       404:
 *        $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoPlayerStatData'
 *       500:
 *        $ref: '#/components/responses/Error'
 */
 router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    if (
      req.body[0].match_id == null ||
      req.body[0].map_id == null ||
      req.body[0].team_id == null ||
      req.body[0].steam_id == null ||
      req.body[0].api_key == null
    ) {
      res.status(412).json({ message: "Required Data Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT mtch.user_id as user_id, mtch.cancelled as cancelled, mtch.forfeit as forfeit, mtch.end_time as mtch_end_time, mtch.api_key as mtch_api_key FROM `match` mtch, map_stats mstat WHERE mtch.id=? AND mstat.match_id=mtch.id";
    const matchRow = await db.query(currentMatchInfo, req.body[0].match_id);
    if (!matchRow.length) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      matchRow[0].mtch_api_key != req.body[0].api_key &&
      !Utils.superAdminCheck(req.user)
    ) {      
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].mtch_end_time != null
    ) {
      res.status(401).json({
        message: "Match is already finished. Cannot update historical matches.",
      });
      return;
    } else {
      let updateStmt = {
        round_number: req.body[0].round_number,
        round_time: req.body[0].round_time,
        attacker_steam_id: req.body[0].attacker_steam_id,
        attacker_name: req.body[0].attacker_name,
        attacker_side: req.body[0].attacker_side,
        weapon: req.body[0].weapon,
        bomb: req.body[0].bomb,
        deaths: req.body[0].deaths,
        headshot: req.body[0].headshot,
        thru_smoke: req.body[0].thru_smoke,
        attacker_blind: req.body[0].attacker_blind,
        no_scope: req.body[0].no_scope,
        suicide: req.body[0].suicide,
        friendly_fire: req.body[0].friendly_fire,
        assister_steam_id: req.body[0].assister_steam_id,
        assister_name: req.body[0].assister_name,
        assister_side: req.body[0].assister_side,
        assist_friendly_fire: req.body[0].assist_friendly_fire,
        flash_assist: req.body[0].flash_assist
      };
      // Remove any values that may not be updated.
      updateStmt = await db.buildUpdateStatement(updateStmt);
      if (!Object.keys(updateStmt)) {
        res
          .status(412)
          .json({ message: "No update data has been provided." });
        return;
      }
      let sql =
        "UPDATE player_stat_extras SET ? WHERE map_id = ? AND match_id = ? AND player_stat_id = ?";
      const updatedPlayerStats = await db.query(sql, [
        updateStmt,
        req.body[0].map_id,
        req.body[0].match_id,
        req.body[0].player_stat_id,
      ]);
      if (updatedPlayerStats.affectedRows > 0) {
        res.json({ message: "Extra Player Stats were updated successfully!" });
      } else {
        sql = "INSERT INTO player_stats SET ?";
        // Update values to include match/map/steam_id.
        updateStmt.player_steam_id = req.body[0].player_steam_id;
        updateStmt.map_id = req.body[0].map_id;
        updateStmt.match_id = req.body[0].match_id;
        updateStmt.team_id = req.body[0].team_id;
        await db.query(sql, [updateStmt]);
        res.json({ message: "Extra Player Stats Inserted Successfully!" });
      }
      GlobalEmitter.emit("playerStatsExtraUpdate");
      return;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstatsextras:
 *   delete:
 *     description: Delete all additional player stats object from a match.
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
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stat deleted
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
 *         $ref: '#/components/responses/NoPlayerStatData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", async (req, res, next) => {
  try {
    if (req.body[0].match_id == null) {
      res.status(412).json({ message: "Required Data Not Provided" });
      return;
    }
    let currentMatchInfo =
      "SELECT mtch.user_id as user_id, mtch.cancelled as cancelled, mtch.forfeit as forfeit, mtch.end_time as mtch_end_time, mtch.api_key as mtch_api_key FROM `match` mtch, map_stats mstat WHERE mtch.id=?";
    const matchRow = await db.query(currentMatchInfo, req.body[0].match_id);
    if (!matchRow.length) {
      res.status(404).json({ message: "No player stats data found." });
      return;
    } else if (
      matchRow[0].user_id != req.user.id &&
      !Utils.superAdminCheck(req.user)
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].mtch_end_time != null
    ) {
      let deleteSql = "DELETE FROM player_stat_extras; WHERE match_id = ?";
      const delRows = await db.query(deleteSql, [
        req.body[0].match_id,
      ]);
      if (delRows.affectedRows > 0) {
        GlobalEmitter.emit("playerStatsExtraUpdate");
        res.json({ message: "Player stats has been deleted successfully." });
        return;
      } else {
        throw "Something went wrong deleting the data. Player stats remain intact.";
      }
    } else {
      res.status(401).json({
        message: "Match is currently live. Cannot delete from live matches.",
      });
      return;
    }
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