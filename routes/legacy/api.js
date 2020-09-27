/** Express API router for teams in get5.
 * @module routes/legacy/api
 * @requires express
 * @requires db
 */
let express = require("express");
/** Express module
 * @const
 */
const router = express.Router();
/** Database module.
 * @const
 */
const db = require("../../db");

/** Rate limit includes.
 * @const
 */
const rateLimit = require('express-rate-limit');

/** Basic Rate limiter.
 * @const 
 */
const basicRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    message: "Too many requests from this IP. Please try again in an hour.",
    keyGenerator: async (req) => {      
      try{
        const api_key = await db.query("SELECT api_key FROM `match` WHERE id = ?", req.params.match_id);
        if(api_key[0].api_key.localeCompare(req.query.key))
          return api_key[0].api_key;
        else
          return req.ip;
      } catch (err){
        return req.ip;
      }
    }
});

/** Map Update Rate Limiter.
 * @const
 */
const updateMapRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: "Too many requests from this IP. Please try again in an hour.",
    keyGenerator: async (req) => {      
      try{
        const api_key = await db.query("SELECT api_key FROM `match` WHERE id = ?", req.params.match_id);
        if(api_key[0].api_key.localeCompare(req.query.key))
          return api_key[0].api_key;
        else
          return req.ip;
      } catch (err){
        return req.ip;
      }
    }
});

/** Player Stats Rate Limiter.
 * @const
 */
const playerStatRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: "Too many requests from this IP. Please try again in an hour.",
    keyGenerator: async (req) => {      
      try{
        const api_key = await db.query("SELECT api_key FROM `match` WHERE id = ?", req.params.match_id);
        if(api_key[0].api_key.localeCompare(req.query.key))
          return api_key[0].api_key;
        else
          return req.ip;
      } catch (err){
        return req.ip;
      }
    }
});

/**
 * @swagger
 *
 * /match/:match_id/finish:
 *   post:
 *     description: Updates an existing server.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              winner:
 *                type: string
 *                description: The string for which team won the match. team1 or team2.
 *              forfeit:
 *                type: integer
 *                description: Optional if a team has forfeit a match.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/finish", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let winner = req.query.winner == null ? null : req.query.winner;
    let forfeit = req.query.forfeit == null ? 0 : req.query.forfeit;

    // Local data manipulation.
    let teamIdWinner = null;
    let end_time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let matchFinalized = true;
    let team1Score = 0;
    let team2Score = 0;

    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    if (matchValues[0].end_time !== null && matchValues[0].cancelled !== null)
      matchFinalized = false;

    // Throw error if wrong.
    await check_api_key(matchValues[0].api_key, req.query.key, matchFinalized);

    if(winner === "team1")
      teamIdWinner = matchValues[0].team1_id;
    else if(winner === "team2")
      teamIdWinner = matchValues[0].team2_id;  
    if(forfeit === 1){
      if(winner === "team1"){
        team1Score = 1;
        team2Score = 0;
      } else if(winner === "team2"){
        team1Score = 0;
        team2Score = 1;
      }

    }

    await db.withTransaction (async () => {
      let updateStmt = {
        winner: teamIdWinner,
        forfeit: forfeit,
        team1_score: team1Score,
        team2_score: team2Score,
        start_time: matchValues[0].start_time || new Date().toISOString().slice(0, 19).replace('T', ' '),
        end_time: end_time
      }
      // Remove any values that may not be updated.
      for (let key in updateStmt) {
        if (updateStmt[key] === null) delete updateStmt[key];
      }
      let updateSql = "UPDATE `match` SET ? WHERE id = ?";
      await db.query(updateSql, [updateStmt, matchID]);
      // Set the server to not be in use.
      await db.query("UPDATE game_server SET in_use = 0 WHERE id = ?", [matchValues[0].server_id]);
      res.status(200).send('Success');
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/start:
 *   post:
 *     description: Begin a map within a match series.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              map_number:
 *                type: integer
 *                description: The given map number to start.
 *              mapname:
 *                type: string
 *                description: The given map name to update in the map stats object.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/map/:map_number/start", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let mapNumber = req.params.map_number == null ? null : req.params.map_number;
    let mapName = req.query.mapname == null ? null : req.query.mapname;
    // Data manipulation inside function.
    let startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let updateStmt = {};
    let insertStmt = {};
    let updateSql;
    let insertSql;
    let matchFinalized = true;
    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    if (matchValues[0].end_time !== null && matchValues[0].cancelled !== null)  
      matchFinalized = false;

    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, req.query.key, matchFinalized);

    // Begin transaction
    await db.withTransaction(async () => {
      if(matchValues[0].start_time === null){
        // Update match stats to have a start time.
        updateStmt = {
          start_time: startTime
        };
        updateSql = "UPDATE `match` SET ? WHERE id = ?";
        await db.query(updateSql, [updateStmt, matchID]);
      }
      // Get or create mapstats.
      sql = "SELECT * FROM map_stats WHERE match_id = ? AND map_number = ?";
      const mapStats = await db.query(sql, [matchID, mapNumber]);
      if (mapStats.length > 0){
        updateStmt = {
          mapnumber: mapNumber,
          mapname: mapName,
        };
        updateSql = "UPDATE map_stats SET ? WHERE match_id = ? AND map_number = ?";
        // Remove any values that may not be updated.
        for (let key in updateStmt) {
          if (updateStmt[key] === null) delete updateStmt[key];
        }
        await db.query(updateSql, [updateStmt, matchID, mapNumber]);
      } else {
        insertStmt = {
          match_id: matchID,
          map_number: mapNumber,
          map_name: mapName,
          start_time: startTime,
          team1_score: 0,
          team2_score: 0
        };
        insertSql = "INSERT INTO map_stats SET ?";
        await db.query(sql, [insertStmt]);
      }
    });
    res.status(200).send('Success');
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/update:
 *   post:
 *     description: Update a match with the score.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              team1_score:
 *                type: integer
 *                description: The score for team1.
 *              team2_score:
 *                type: integer
 *                description: The score for team2.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *              map_number:
 *                type: integer
 *                description: The given map number from the URI path.
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/map/:map_number/update", updateMapRateLimit, async (req, res, next) => {
  try{
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let mapNumber = req.params.map_number == null ? null : req.params.map_number;
    let team1Score = req.query.team1_score;
    let team2Score = req.query.team2_score;
    // Data manipulation inside function.
    let updateStmt = {};
    let updateSql;
    let matchFinalized = true;
    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    if (matchValues[0].end_time !== null && matchValues[0].cancelled !== null)  
      matchFinalized = false;

    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, req.query.key, matchFinalized);

    await db.withTransaction(async ()  => {
      // Get or create mapstats.
      sql = "SELECT * FROM map_stats WHERE match_id = ? AND map_number = ?";
      const mapStats = await db.query(sql, [matchID, mapNumber]);
      if(mapStats.length > 0){
        if(team1Score !== -1 && team2Score !== -1){
          updateStmt = {
            team1_score: team1Score,
            team2_score: team2Score
          };
          updateSql = "UPDATE map_stats SET ? WHERE match_id = ? AND map_number = ?"
          await db.query(updateSql, [updateStmt, matchID, mapNumber]);
          res.status(200).send('Success');
        }
        else{
          res.status(400).send('Failed to find map stats object');
        }
      }
    });

  }catch (err){
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /match/:match_id/vetoUpdate:
 *   post:
 *     description: Route serving to update the vetos in the database.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              teamString:
 *                type: string
 *                description: The team string consisting of either team1, team2, or nothing.
 *              map:
 *                type: string
 *                description: The map the team has picked or banned.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 *              pick_or_veto:
 *                type: string
 *                description: The action taken upon the team.
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/vetoUpdate", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let teamString = req.query.teamString == null ? null : req.query.teamString;
    let mapBan = req.query.map == null ? null : req.query.map;
    let pickOrBan = req.query.pick_or_veto == null ? null : req.query.pick_or_veto;
    // Data manipulation inside function.
    let insertStmt = {};
    let insertSql;
    let teamID;
    let teamNameString;
    let matchFinalized = true;
    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);

    if (matchValues[0].end_time !== null && matchValues[0].cancelled !== null)  
      matchFinalized = false;

    // Throw error if wrong key or finished match.
    await check_api_key(matchValues[0].api_key, req.query.key, matchFinalized);

    if (teamString === "team1")
        teamID = matchValues[0].team1_id;
    else if (teamString === "team2")
      teamID = matchValues[0].team2_id;

    sql = "SELECT name FROM team WHERE ID = ?";
    const teamName = db.query(sql, [teamID]);
    if (teamName.length < 1)
      teamNameString = "Decider";
    else
      teamNameString = teamName[0].name;
    // Insert into veto now.
    await db.withTransaction(async () =>{
      insertStmt = {
        match_id: matchID,
        team_name: teamNameString,
        map: mapBan,
        pick_or_veto: pickOrBan
      };
      // Remove any values that may not be updated.
      for (let key in updateStmt) {
        if (updateStmt[key] === null) delete updateStmt[key];
      }
      insertSql = "INSERT INTO veto SET ?";
      await db.query(insertSql, [insertStmt]);
    });
    res.status(200).send('Success');
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /match/:match_id/vetoUpdate:
 *   post:
 *     description: Route serving to update the vetos in the database.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              map_number:
 *                type: integer
 *                description: The map id of a given match.
 *              demoFile:
 *                type: string
 *                description: The URL for a demo file in string form.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/map/:map_number/demo", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let mapNum = req.params.map_number == null ? null : req.params.map_number;
    let demoFile = req.query.demoFile == null ? null : req.query.demoFile;
    // Data manipulation inside function.
    let updateStmt = {};
    let updateSql;
    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);
    
    // Throw error if wrong key. Match finish doesn't matter.
    await check_api_key(matchValues[0].api_key, req.query.key, false);

    sql =
      "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
    const mapStatValues = await db.query(sql, [matchID, mapNum]);

    if (mapStatValues.length < 1)
      res.status(404).send('Failed to find map stats object.');

    // Update map stats with new demo file link.
    await db.withTransaction(async () =>{
      updateStmt = {
        demoFile: demoFile,
      };
      // Remove any values that may not be updated.
      for (let key in updateStmt) {
        if (updateStmt[key] === null) delete updateStmt[key];
      }
      updateSql = "UPDATE map_stats SET ? WHERE id = ?";
      await db.query(updateSql, [updateStmt, mapStatValues[0].id]);
    });
    res.status(200).send('Success');
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/finish:
 *   post:
 *     description: Route serving to finish a map within a series.
 *     produces:
 *       - text/plain
 *     requestBody:
 *      required: true
 *      content:
 *        text/plain:
 *          schema:
 *            type: object
 *            properties:
 *              key:
 *                type: integer
 *                description: The API key given from the game server to compare.
 *              winner:
 *                type: string
 *                description: The string representation of the winner, usually team1 or team2.
 *              map_number:
 *                type: integer
 *                description: The map id of a given match.
 *              match_id:
 *                type: integer
 *                description: The given match ID from the path.
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/map/:map_number/finish", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : req.params.match_id;
    let mapNum = req.params.map_number == null ? null : req.params.map_number;
    let winner = req.query.winner == null ? null : req.query.winner;
    // Data manipulation inside function.
    let updateStmt = {};
    let updateSql;
    let mapEndTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let matchFinalized = true;
    let teamIdWinner;
    let team1Score;
    let team2Score;
    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);
    
    if (matchValues[0].end_time !== null && matchValues[0].cancelled !== null)  
      matchFinalized = false;
    // Throw error if wrong key. Match finish doesn't matter.
    await check_api_key(matchValues[0].api_key, req.query.key, matchFinalized);

    sql =
      "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
    const mapStatValues = await db.query(sql, [matchID, mapNum]);

    if (mapStatValues.length < 1)
      res.status(404).send('Failed to find map stats object.');

    // Update map stats with new demo file link.
    await db.withTransaction(async () =>{
      if(winner === "team1"){
        teamIdWinner = matchValues[0].team1_id;
        team1Score = matchValues[0].team1_score + 1;
      } else if (winner === "team2"){
        teamIdWinner = matchValues[0].team2_id;
        team2Score = matchValues[0].team2_score + 1;
      }
      updateStmt = {
        end_time: mapEndTime,
        winner: teamIdWinner
      };
      // Remove any values that may not be updated.
      for (let key in updateStmt) {
        if (updateStmt[key] === null) delete updateStmt[key];
      }
      updateSql = "UPDATE map_stats SET ? WHERE id = ?";
      await db.query(updateSql, [updateStmt, mapStatValues[0].id]);

      // Update match now.
      updateStmt = {
        team1_score: team1Score,
        team2_score: team2Score
      }
      // Remove any values that may not be updated.
      for (let key in updateStmt) {
        if (updateStmt[key] === null) delete updateStmt[key];
      }
      updateSql = "UPDATE `match` SET ? WHERE ID = ?"
      await db.query(updateSql, [updateStmt, matchID])
    });
    res.status(200).send('Success');
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /match/:match_id/map/:map_number/player/:steam_id/update:
 *   post:
 *     description: Route serving to update a players stats within a match.
 *     produces:
 *       - text/plain
 *     requestBody:
 *      required: true
 *      content:
 *        text/plain:
 *          schema:
 *            $ref: '#/components/schemas/PlayerStats'
 * 
 *     tags:
 *       - legacy
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *             text/plain:
 *                schema:
 *                  type: string
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/:match_id/map/:map_number/player/:steam_id/update", playerStatRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id == null ? null : parseInt(req.params.match_id);
    let mapNum = req.params.map_number == null ? null : parseInt(req.params.map_number);
    let steamId = req.params.steam_id == null ? null : req.params.steam_id;
    let playerName = req.query.name == null ? null : req.query.name;
    let playerTeam = req.query.team == null ? null : req.query.team;
    let playerKills = req.query.kills == null ? null : parseInt(req.query.kills);
    let playerAssists = req.query.assists == null ? null : parseInt(req.query.assists) ;
    let playerDeaths = req.query.deaths == null ? null : parseInt(req.query.deaths);
    let playerFBA = req.query.flashbang_assists == null ? null : parseInt(req.query.flashbang_assists);
    let playerTKs = req.query.teamkills == null ? null : parseInt(req.query.teamkills);
    let playerSuicide = req.query.suicides == null ? null : parseInt(req.query.suicides);
    let playerDamage = req.query.damage == null ? null : parseInt(req.query.damage);
    let playerHSK = req.query.headshot_kills == null ? null : parseInt(req.query.headshot_kills);
    let playerRoundsPlayed = req.query.roundsplayed == null ? null : parseInt(req.query.roundsplayed);
    let playerBombsPlanted = req.query.bomb_plants == null ? null : parseInt(req.query.bomb_plants);
    let playerBombsDefused = req.query.bomb_defuses == null ? null : parseInt(req.query.bomb_defuses);
    let player1k = req.query['1kill_rounds'] == null ? null : parseInt(req.query['1kill_rounds']);
    let player2k = req.query['2kill_rounds'] == null ? null : parseInt(req.query['2kill_rounds']);
    let player3k = req.query['3kill_rounds'] == null ? null : parseInt(req.query['3kill_rounds']);
    let player4k = req.query['4kill_rounds'] == null ? null : parseInt(req.query['4kill_rounds']);
    let player5k = req.query['5kill_rounds'] == null ? null : parseInt(req.query['5kill_rounds']);
    let player1v1 = req.query.v1 == null ? null : parseInt(req.query.v1);
    let player1v2 = req.query.v2 == null ? null : parseInt(req.query.v2);
    let player1v3 = req.query.v3 == null ? null : parseInt(req.query.v3);
    let player1v4 = req.query.v4 == null ? null : parseInt(req.query.v4);
    let player1v5 = req.query.v5 == null ? null : parseInt(req.query.v5);
    let playerFirstKillT = req.query.firstkill_t == null ? null : parseInt(req.query.firstkill_t);
    let playerFirstKillCT = req.query.firstkill_ct == null ? null : parseInt(req.query.firstkill_ct);
    let playerFirstDeathCT = req.query.firstdeath_ct == null ? null : parseInt(req.query.firstdeath_ct);
    let playerFirstDeathT = req.query.firstdeath_t == null ? null : parseInt(req.query.firstdeath_t);
    // Data manipulation inside function.
    let updateStmt = {};
    let updateSql;
    let matchFinalized = true;
    let playerTeamId;
    // Database calls.
    let sql =
      "SELECT * FROM `match` WHERE id = ?";
    const matchValues = await db.query(sql, matchID);
    
    if (matchValues[0].end_time !== null && matchValues[0].cancelled !== null)  
      matchFinalized = false;
    // Throw error if wrong key. Match finish doesn't matter.
    await check_api_key(matchValues[0].api_key, req.query.key, matchFinalized);

    sql =
      "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
    const mapStatValues = await db.query(sql, [matchID, mapNum]);

    if (mapStatValues.length < 1)
      res.status(404).send('Failed to find map stats object.');
    
    // Get player stats if exists, if not we create it.
    sql =
      "SELECT * FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
    const playerStatValues = await db.query(sql, [matchID, mapStatValues[0].id, steamId]);

    // Update player stats. ACID transaction.
    await db.withTransaction(async () =>{
      if(playerTeam === "team1")
        playerTeamId = matchValues[0].team1_id;
      else if (playerTeam === "team2")
        playerTeamId = matchValues[0].team2_id;

      updateStmt = {
        match_id: matchID,
        map_id: mapStatValues[0].id,
        team_id: playerTeamId,
        steam_id: steamId,
        name: playerName,
        kills: playerKills,
        deaths: playerDeaths,
        roundsplayed: playerRoundsPlayed,
        assists: playerAssists,
        flashbang_assists: playerFBA,
        teamkills: playerTKs,
        suicides: playerSuicide,
        headshot_kills: playerHSK,
        damage: playerDamage,
        bomb_plants: playerBombsPlanted,
        bomb_defuses: playerBombsDefused,
        v1: player1v1,
        v2: player1v2,
        v3: player1v3,
        v4: player1v4,
        v5: player1v5,
        k1: player1k,
        k2: player2k,
        k3: player3k,
        k4: player4k,
        k5: player5k,
        firstdeath_ct: playerFirstDeathCT,
        firstdeath_t: playerFirstDeathT,
        firstkill_ct: playerFirstKillCT,
        firstkill_t: playerFirstKillT
      };
      // Remove any values that may not be updated.
      for (let key in updateStmt) {
        if (updateStmt[key] === null) delete updateStmt[key];
      }
      if (playerStatValues.length < 1){
        updateSql = "INSERT INTO player_stats SET ?";
        await db.query(updateSql, [updateStmt]);
      } else{
        updateSql = "UPDATE player_stats SET ? WHERE id = ?";
        await db.query(updateSql, [updateStmt, playerStatValues[0].id]);
      }
    });
    res.status(200).send('Success');
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** Reports whether the match is given a correct API key, or if the match has finished.
 * @function
 * @memberof module:legacy/api
 * @param {string} match_api_key - The match API from the database.
 * @param {string} given_api_key - The given API key from the request.
 * @param {number} match_finished - Whether the match is finished or not.
 */
async function check_api_key(match_api_key, given_api_key, match_finished) {
    if (match_api_key.localeCompare(given_api_key) !== 0)
        throw "Not a correct API Key.";
    if (match_finished === 1)
        throw "Match is already finalized.";
    return;
}

module.exports = router;
