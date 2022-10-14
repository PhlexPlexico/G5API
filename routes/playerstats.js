/**
 * @swagger
 * resourcePath: /playerstats
 * description: Express API for player stats in Get5 matches.
 */
import { Router } from "express";
import app from "../app.js";

const router = Router();

import db from "../db.js";

import Utils from "../utility/utils.js";

import GlobalEmitter from "../utility/emitter.js";

/* Swagger shared definitions */
/**
 * @swagger
 *
 * components:
 *   schemas:
 *     PlayerStats:
 *       type: object
 *       required:
 *         - match_id
 *         - map_id
 *         - team_id
 *         - steam_id
 *         - name
 *       properties:
 *         match_id:
 *           type: integer
 *           description: Match identifier in the system.
 *         map_id:
 *           type: integer
 *           description: Integer determining the current map of the match.
 *         team_id:
 *           type: integer
 *           description: Integer determining the team a player is on.
 *         steam_id:
 *           type: string
 *           description: String that reprsents a players Steam64 ID.
 *         name:
 *           type: string
 *           description: String determining player's name.
 *         kills:
 *           type: integer
 *           description: Integer representing amount of kills.
 *         deaths:
 *           type: integer
 *           description: Integer representing amount of deaths.
 *         roundsplayed:
 *           type: integer
 *           description: Integer representing amount of roundsplayed.
 *         assists:
 *           type: integer
 *           description: Integer representing amount of assists.
 *         flashbang_assists:
 *           type: integer
 *           description: Integer representing amount of flashbang assists.
 *         teamkills:
 *           type: integer
 *           description: Integer representing amount of team kills.
 *         knife_kills:
 *           type: integer
 *           description: Integer representing amount of knife kills.
 *         suicides:
 *           type: integer
 *           description: Integer representing amount of suicides.
 *         headshot_kills:
 *           type: integer
 *           description: Integer representing amount of headshot kills.
 *         damage:
 *           type: integer
 *           description: Integer representing amount of damage.
 *         util_damage:
 *           type: integer
 *           description: Integer representing amount of damage in utility.
 *         enemies_flashed:
 *           type: integer
 *           description: Integer reprsentation of enemies flashed.
 *         friendlies_flashed:
 *           type: integer
 *           description: Integer reprsentation of teammates flashed.
 *         bomb_plants:
 *           type: integer
 *           description: Integer representing amount of bomb plants.
 *         bomb_defuses:
 *           type: integer
 *           description: Integer representing amount of bomb defuses.
 *         v1:
 *           type: integer
 *           description: Integer representing amount of 1v1s.
 *         v2:
 *           type: integer
 *           description: Integer representing amount of 1v2s.
 *         v3:
 *           type: integer
 *           description: Integer representing amount of 1v3s.
 *         v4:
 *           type: integer
 *           description: Integer representing amount of 1v4s.
 *         v5:
 *           type: integer
 *           description: Integer representing amount of 1v5s.
 *         k1:
 *           type: integer
 *           description: Integer representing amount of 1 kill rounds.
 *         k2:
 *           type: integer
 *           description: Integer representing amount of 2 kill rounds.
 *         k3:
 *           type: integer
 *           description: Integer representing amount of 3 kill rounds.
 *         k4:
 *           type: integer
 *           description: Integer representing amount of 4 kill rounds.
 *         k5:
 *           type: integer
 *           description: Integer representing amount of 5 kill rounds.
 *         firstdeath_ct:
 *           type: integer
 *           description: Integer representing amount of times a player died as a CT first in a round.
 *         firstdeath_t:
 *           type: integer
 *           description: Integer representing amount of times a player died as a T first in a round.
 *         firstkill_ct:
 *           type: integer
 *           description: Integer representing amount of times a player killed as a CT first in a round.
 *         firstkill_t:
 *           type: integer
 *           description: Integer representing amount of times a player killed as a T first in a round.
 *         kast:
 *           type: integer
 *           description: Integer representing the KAST value of a player during the match.
 *         contribution_score:
 *           type: integer
 *           description: Integer representing the contribution score of a player.
 *         mvp:
 *           type: integer
 *           description: Integer representing the amount of MVPs the players had.
 *
 *   responses:
 *     NoPlayerStatData:
 *       description: No playerstat data was provided.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /playerstats/:
 *   get:
 *     description: Route serving to get all player statistics.
 *     produces:
 *       - application/json
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player Stats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerStats'
 *       400:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM player_stats";
    const playerStats = await db.query(sql);
    if (!playerStats.length) {
      res.status(404).json({ message: "No stats found on the site!" });
      return;
    }
    res.json({ playerStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/unique:
 *   get:
 *     description: Gets a unique player count from the map stats table.
 *     produces:
 *       - application/json
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Player stats from a given user.
 *         content:
 *           application/json:
 *             schema:
 *               type: integer
 *               description: Unique count of players who have played matches.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/unique", async (req, res, next) => {
  try {
    let sql = "SELECT COUNT(DISTINCT steam_id) as cnt FROM player_stats";
    const playercount = await db.query(sql);
    if (playercount[0].cnt === 0) {
      res.status(404).json({ message: "No stats found." });
      return;
    }
    res.json({ count: playercount[0].cnt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/:steam_id:
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
 *                 $ref: '#/components/schemas/PlayerStats'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:steam_id", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    let sql = "SELECT * FROM player_stats where steam_id = ?";
    const playerstats = await db.query(sql, steamID);
    if (!playerstats.length) {
      res.status(404).json({ message: "No stats found for player " + steamID });
      return;
    }
    res.json({ playerstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/:steam_id/pug:
 *   get:
 *     description: Player stats from a given Steam ID involved in PUGs
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
 *                 $ref: '#/components/schemas/PlayerStats'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:steam_id/pug", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    let playerstats = await getPlayerStats(steamID, null, true);
    if (!playerstats) {
      res.status(404).json({ message: "No stats found for player " + steamID });
      return;
    }
    res.json({ playerstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/:steam_id/official:
 *   get:
 *     description: Player stats from a given Steam ID involved in official matches.
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
 *                 $ref: '#/components/schemas/PlayerStats'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:steam_id/official", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    let playerstats = await getPlayerStats(steamID);
    if (!playerstats) {
      res.status(404).json({ message: "No stats found for player " + steamID });
      return;
    }
    res.json({ playerstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/:steam_id/season/:season_id:
 *   get:
 *     description: Player stats from a given Steam ID involved in a speciefic season.
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
 *                 $ref: '#/components/schemas/PlayerStats'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/:steam_id/season/:season_id", async (req, res, next) => {
  try {
    let steamID = req.params.steam_id;
    let seasonId = req.params.season_id;
    let playerstats = await getPlayerStats(steamID, seasonId);
    if (!playerstats) {
      res.status(404).json({ message: "No stats found for player " + steamID });
      return;
    }
    res.json({ playerstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/match/:match_id:
 *   get:
 *     description: Player stats from a given match in the system.
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
 *                 $ref: '#/components/schemas/PlayerStats'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/match/:match_id", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM player_stats where match_id = ?";
    const playerstats = await db.query(sql, matchID);
    if (!playerstats.length) {
      res.status(404).json({ message: "No stats found for match " + matchID });
      return;
    }
    res.json({ playerstats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /playerstats/match/:match_id/stream:
 *   get:
 *     description: Player stats from a given match in the system represented by a text-stream for real time updates.
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
 *                 $ref: '#/components/schemas/PlayerStats'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
 router.get("/match/:match_id/stream", async (req, res, next) => {
  try {
    let matchID = req.params.match_id;
    let sql = "SELECT * FROM player_stats where match_id = ?";
    let playerstats = await db.query(sql, matchID);

    res.set({
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    playerstats = playerstats.map(v => Object.assign({}, v));
    let playerString = `event: playerstats\ndata: ${JSON.stringify(playerstats)}\n\n`
    
    // Need to name the function in order to remove it!
    const playerStreamStats = async () => {
      playerstats = await db.query(sql, matchID);
      playerstats = playerstats.map(v => Object.assign({}, v));
      playerString = `event: playerstats\ndata: ${JSON.stringify(playerstats)}\n\n`
      res.write(playerString);
    };

    GlobalEmitter.on("playerStatsUpdate", playerStreamStats);

    res.write(playerString);
    req.on("close", () => {
      GlobalEmitter.removeListener("playerStatsUpdate", playerStreamStats);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("playerStatsUpdate", playerStreamStats);
      res.end();
    });
  } catch (err) {
    console.error(err.toString());
    res.status(500).write(`event: error\ndata: ${err.toString()}\n\n`)
    res.end();
  }
});

/** @swagger
 *
 * /playerstats/:steam_id/recent:
 *   get:
 *     description: Get a steam ID's recent matches
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: steam_id
 *         description: The steam ID of the user
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - playerstats
 *     responses:
 *       200:
 *         description: Last five matches from the steam ID provided.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */

 router.get("/:steam_id/recent", async (req, res, next) => {
  try {
    let steamId = req.params.steam_id;
    let sql =
      "SELECT DISTINCT rec_matches.id, " +
      "rec_matches.user_id, " +
      "rec_matches.team1_id, " +
      "rec_matches.team2_id, " +
      "rec_matches.team1_string, " +
      "rec_matches.team2_string " +
      "FROM `match` rec_matches JOIN player_stats ps " +
      "ON ps.match_id = rec_matches.id " +
      "WHERE (rec_matches.cancelled = 0 OR rec_matches.cancelled IS NULL) " +
      "AND  ps.steam_id=? " +
      "ORDER BY rec_matches.id DESC LIMIT 5";
    const matches = await db.query(sql, [steamId]);
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});


/**
 * @swagger
 *
 * /playerstats:
 *   post:
 *     description: Create player stats in a match/map.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/PlayerStats'
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
        match_id: req.body[0].match_id,
        map_id: req.body[0].map_id,
        team_id: req.body[0].team_id,
        steam_id: req.body[0].steam_id,
        name: req.body[0].name,
        kills: req.body[0].kills,
        deaths: req.body[0].deaths,
        roundsplayed: req.body[0].roundsplayed,
        assists: req.body[0].assists,
        flashbang_assists: req.body[0].flashbang_assists,
        teamkills: req.body[0].teamkills,
        knife_kills: req.body[0].knife_kills,
        suicides: req.body[0].suicides,
        headshot_kills: req.body[0].headshot_kills,
        damage: req.body[0].damage,
        util_damage: req.body[0].util_damage,
        enemies_flashed: req.body[0].enemies_flashed,
        friendlies_flashed: req.body[0].friendlies_flashed,
        bomb_plants: req.body[0].bomb_plants,
        bomb_defuses: req.body[0].bomb_defuses,
        v1: req.body[0].v1,
        v2: req.body[0].v2,
        v3: req.body[0].v3,
        v4: req.body[0].v4,
        v5: req.body[0].v5,
        k1: req.body[0].k1,
        k2: req.body[0].k2,
        k3: req.body[0].k3,
        k4: req.body[0].k4,
        k5: req.body[0].k5,
        firstdeath_ct: req.body[0].firstdeath_ct,
        firstdeath_t: req.body[0].firstdeath_t,
        firstkill_ct: req.body[0].firstkill_ct,
        firstkill_t: req.body[0].firstkill_t,
        kast: req.body[0].kast,
        contribution_score: req.body[0].contribution_score,
        mvp: req.body[0].mvp
      };
      let sql = "INSERT INTO player_stats SET ?";
      // Remove any values that may not be inserted off the hop.
      insertSet = await db.buildUpdateStatement(insertSet);
      let insertPlayStats = await db.query(sql, [insertSet]);
      GlobalEmitter.emit("playerStatsUpdate");
      res.json({
        message: "Player Stats inserted successfully!",
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
 * /playerstats:
 *   put:
 *     description: Update player stats in a match/map.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/PlayerStats'
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
        name: req.body[0].name,
        kills: req.body[0].kills,
        deaths: req.body[0].deaths,
        roundsplayed: req.body[0].roundsplayed,
        assists: req.body[0].assists,
        flashbang_assists: req.body[0].flashbang_assists,
        teamkills: req.body[0].teamkills,
        knife_kills: req.body[0].knife_kills,
        suicides: req.body[0].suicides,
        headshot_kills: req.body[0].headshot_kills,
        damage: req.body[0].damage,
        util_damage: req.body[0].util_damage,
        enemies_flashed: req.body[0].enemies_flashed,
        friendlies_flashed: req.body[0].friendlies_flashed,
        bomb_plants: req.body[0].bomb_plants,
        bomb_defuses: req.body[0].bomb_defuses,
        v1: req.body[0].v1,
        v2: req.body[0].v2,
        v3: req.body[0].v3,
        v4: req.body[0].v4,
        v5: req.body[0].v5,
        k1: req.body[0].k1,
        k2: req.body[0].k2,
        k3: req.body[0].k3,
        k4: req.body[0].k4,
        k5: req.body[0].k5,
        firstdeath_ct: req.body[0].firstdeath_ct,
        firstdeath_t: req.body[0].firstdeath_t,
        firstkill_ct: req.body[0].firstkill_ct,
        firstkill_t: req.body[0].firstkill_t,
        kast: req.body[0].kast,
        contribution_score: req.body[0].contribution_score,
        mvp: req.body[0].mvp
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
        "UPDATE player_stats SET ? WHERE map_id = ? AND match_id = ? AND steam_id = ?";
      const updatedPlayerStats = await db.query(sql, [
        updateStmt,
        req.body[0].map_id,
        req.body[0].match_id,
        req.body[0].steam_id,
      ]);
      if (updatedPlayerStats.affectedRows > 0) {
        res.json({ message: "Player Stats were updated successfully!" });
      } else {
        sql = "INSERT INTO player_stats SET ?";
        // Update values to include match/map/steam_id.
        updateStmt.steam_id = req.body[0].steam_id;
        updateStmt.map_id = req.body[0].map_id;
        updateStmt.match_id = req.body[0].match_id;
        //If a player is a standin we should still record stats as "that team".
        updateStmt.team_id = req.body[0].team_id;
        await db.query(sql, [updateStmt]);
        res.json({ message: "Player Stats Inserted Successfully!" });
      }
      GlobalEmitter.emit("playerStatsUpdate");
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
 * /playerstats:
 *   delete:
 *     description: Delete all player stats object from a match.
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
      let deleteSql = "DELETE FROM player_stats WHERE match_id = ?";
      const delRows = await db.query(deleteSql, [
        req.body[0].match_id,
      ]);
      if (delRows.affectedRows > 0) {
        GlobalEmitter.emit("playerStatsUpdate");
        res.json({ message: "Player stats has been deleted successfully." });
        return;
      } else {
        throw "Something went wrong deleting the data. Player stats remain intact.";
      }
    } else {
      res.status(401).json({
        message: "Match is currently live. Cannot delete live matches.",
      });
      return;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/** Get player stats standing in a season, pug or official matches.
* @function
* @memberof module:routes/playerstats
* @param {string} [steamId] - Steam64 ID.
* @param {string} [seasonId=null] - Season ID to filter.
* @param {boolean} [pug=false] - PUGs to filter.
*/
const getPlayerStats = async (steamId, seasonId = null, pug = false) => {
  let playerStatSql =
    `SELECT  steam_id, name, sum(kills) as kills,
    sum(deaths) as deaths, sum(assists) as assists, sum(k1) as k1,
    sum(k2) as k2, sum(k3) as k3,
    sum(k4) as k4, sum(k5) as k5, sum(v1) as v1,
    sum(v2) as v2, sum(v3) as v3, sum(v4) as v4,
    sum(v5) as v5, sum(roundsplayed) as trp, sum(flashbang_assists) as fba,
    sum(damage) as dmg, sum(headshot_kills) as hsk, count(id) as totalMaps,
    sum(knife_kills) as knifekills, sum(friendlies_flashed) as fflash,
    sum(enemies_flashed) as eflash, sum(util_damage) as utildmg
    FROM    player_stats
    WHERE steam_id = ? 
      AND match_id IN (
        SELECT  id
        FROM    \`match\`
        WHERE   cancelled = 0
        AND     is_pug = ?
    )`;
  let playerStatSqlSeasons =
    `SELECT  steam_id, name, sum(kills) as kills,
    sum(deaths) as deaths, sum(assists) as assists, sum(k1) as k1,
    sum(k2) as k2, sum(k3) as k3,
    sum(k4) as k4, sum(k5) as k5, sum(v1) as v1,
    sum(v2) as v2, sum(v3) as v3, sum(v4) as v4,
    sum(v5) as v5, sum(roundsplayed) as trp, sum(flashbang_assists) as fba,
    sum(damage) as dmg, sum(headshot_kills) as hsk, count(id) as totalMaps,
    sum(knife_kills) as knifekills, sum(friendlies_flashed) as fflash,
    sum(enemies_flashed) as eflash, sum(util_damage) as utildmg
    FROM    player_stats
    WHERE steam_id = ? 
      AND match_id IN (
        SELECT  id
        FROM    \`match\`
        WHERE   cancelled = 0
        AND season_id = ?
        AND     is_pug = ?
    )`;
  let winSql = `SELECT COUNT(*) AS wins FROM \`match\` mtch 
    JOIN player_stats pstat ON mtch.id = pstat.match_id 
    WHERE pstat.team_id = mtch.winner and pstat.steam_id = ?
    AND is_pug = ?`;
  if (pug) {
    winSql = `SELECT COUNT(*) AS wins FROM \`match\` mtch 
    JOIN player_stats pstat ON mtch.id = pstat.match_id 
    WHERE pstat.steam_id = ? AND pstat.winner = 1 
    AND is_pug = ?`;
  }
  let winSqlSeasons = `SELECT COUNT(*) AS wins FROM \`match\` mtch 
    JOIN player_stats pstat ON mtch.id = pstat.match_id 
    WHERE pstat.team_id = mtch.winner and pstat.steam_id = ?
    AND mtch.season_id = ? AND is_pug = ?`;
  let numWins;
  let playerstats;
  if (!seasonId) playerstats = await db.query(playerStatSql, [steamId, pug]);
  else playerstats = await db.query(playerStatSqlSeasons, [steamId, seasonId, pug]);

  if (!playerstats.length) return;

  if (!seasonId) numWins = await db.query(winSql, [steamId, pug]);
  else
    numWins = await db.query(winSqlSeasons, [
      steamId,
      seasonId,
      pug,
    ]);

  return {
    steamId: playerstats[0].steam_id,
    name:
      playerstats[0].name == null
        ? await Utils.getSteamName(playerstats[0].steam_id)
        : playerstats[0].name.replace('/"/g', '\\"'),
    kills: parseFloat(playerstats[0].kills),
    deaths: parseFloat(playerstats[0].deaths),
    assists: parseFloat(playerstats[0].assists),
    k1: parseFloat(playerstats[0].k1),
    k2: parseFloat(playerstats[0].k2),
    k3: parseFloat(playerstats[0].k3),
    k4: parseFloat(playerstats[0].k4),
    k5: parseFloat(playerstats[0].k5),
    v1: parseFloat(playerstats[0].v1),
    v2: parseFloat(playerstats[0].v2),
    v3: parseFloat(playerstats[0].v3),
    v4: parseFloat(playerstats[0].v4),
    v5: parseFloat(playerstats[0].v5),
    trp: parseFloat(playerstats[0].trp),
    fba: parseFloat(playerstats[0].fba),
    total_damage: parseFloat(playerstats[0].dmg),
    hsk: parseFloat(playerstats[0].hsk),
    hsp:
    parseFloat(playerstats[0].kills) === 0
    ? 0
    : (
        (parseFloat(playerstats[0].hsk) /
          parseFloat(playerstats[0].kills)) *
        100
      ).toFixed(2),
    average_rating: Utils.getRating(
    parseFloat(playerstats[0].kills),
    parseFloat(playerstats[0].trp),
    parseFloat(playerstats[0].deaths),
    parseFloat(playerstats[0].k1),
    parseFloat(playerstats[0].k2),
    parseFloat(playerstats[0].k3),
    parseFloat(playerstats[0].k4),
    parseFloat(playerstats[0].k5)
    ),
    wins: numWins[0].wins,
    total_maps: playerstats[0].totalMaps,
  };
}

export default router;
