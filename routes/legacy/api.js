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

/** POST - API Call to finish a match.
 * @name router.post('/:match_id/finish')
 * @function
 * @memberof module:routes/legacy/api
 * @param {string} req.query.key - The API key given from the game server to compare.
 * @param {string} req.query.winner - The string for which team won the match. team1 or team2.
 * @param {int} [req.query.forfeit] - Optional if a team has forfeit a match.
 * @param {int} req.params.match_id - The given match ID from the path.
 */
router.post("/:match_id/finish", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id || null;
    let winner = req.query.winner || null;
    let forfeit = req.query.forfeit || 0;

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

    await withTransaction (db, async () => {
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
    res.status(500).json({ message: err });
  }
});

/** POST - Begin a map within a match series.
 * @name /
 * @function
 * @memberof module:routes/legacy/api
 * @param {int} req.params.match_id - The given match ID to start.
 * @param {string} req.query.key - The API key given from the game server to compare.
 * @param {int} req.params.map_number - The given map number to start.
 * @param {string} req.query.mapname - The given map name to update in the map stats object.
 */
router.post("/:match_id/map/:map_number/start", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id || null;
    let mapNumber = req.params.map_number || null;
    let mapName = req.query.mapname || null;
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
    await withTransaction(db, async () => {
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
    res.status(500).json({ message: err });
  }
});

/** POST - API Call to finish a match.
 * @name router.post('/:match_id/map/:map_number/update')
 * @function
 * @memberof module:routes/legacy/api
 * @param {string} req.query.key - The API key given from the game server to compare.
 * @param {int} req.query.team1_score - The string for which team won the match. team1 or team2.
 * @param {int} req.query.team2_score - Optional if a team has forfeit a match.
 * @param {int} req.params.match_id - The given match ID from the path.
 * @param {int} req.params.map_number - The given map number from the URI path.
 */
router.post("/:match_id/map/:map_number/update", updateMapRateLimit, async (req, res, next) => {
  try{
    // Give from API call.
    let matchID = req.params.match_id || null;
    let mapNumber = req.params.map_number || null;
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

    await withTransaction(db, async ()  => {
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
    res.status(500).json({ message: err });
  }
});

/** POST - Route serving to update the vetos in the database.
 * @name /:match_id/vetoUpdate
 * @function
 * @memberof module:routes/legacy/api
 * @param {string} req.query.key - The API key given from the game server to compare.
 * @param {int} req.query.teamString - The team string consisting of either team1, team2, or nothing.
 * @param {string} req.query.map - The map the team has picked or banned.
 * @param {string} req.query.pick_or_veto - The action taken upon the team.
 * @param {string} req.params.match_id - The ID of the current match.
 */
router.post("/:match_id/vetoUpdate", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id || null;
    let teamString = req.query.teamString || null;
    let mapBan = req.query.map || null;
    let pickOrBan = req.query.pick_or_veto || null;
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
    await withTransaction(db, async () =>{
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
    res.status(500).json({message: err});
  }
});

/** POST - Route serving to retrieve the map demo name that was uploaded.
 * @name /:match_id/map/:map_number/demo
 * @function
 * @memberof module:routes/legacy/api
 * @param {int} req.params.match_id - The id of a given match.
 * @param {int} req.params.map_number - The map id of a given match.
 * @param {string} req.query.demoFile - The URL for a demo file in string form.
 * @param {string} req.query.key - The API key given from the game server to compare.
 */
router.post("/:match_id/map/:map_number/demo", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id || null;
    let mapNum = req.params.map_number || null;
    let demoFile = req.query.demoFile || null;
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
    await withTransaction(db, async () =>{
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
    res.status(500).json({message: err});
  }
});

/** POST - Route serving to finish a map within a series.
 * @name /:match_id/map/:map_number/finish
 * @function
 * @memberof module:routes/legacy/api
 * @param {int} req.params.match_id - The id of a given match.
 * @param {int} req.params.map_number - The map id of a given match.
 * @param {string} req.query.winner - The string representation of the winner, usually team1 or team2.
 * @param {string} req.query.key - The API key given from the game server to compare.
 */
router.post("/:match_id/map/:map_number/finish", basicRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = req.params.match_id || null;
    let mapNum = req.params.map_number || null;
    let winner = req.query.winner || null;
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
    await withTransaction(db, async () =>{
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
    res.status(500).json({message: err});
  }
});

/** POST - Route serving to update a players stats within a match.
 * @name /:match_id/map/:map_number/player/:steam_id/update
 * @function
 * @memberof module:routes/legacy/api
 * @param {int} req.params.match_id - The id of a given match.
 * @param {int} req.params.map_number - The map id of a given match.
 * @param {string} req.params.steam_id - The string representation of a Steam64 ID.
 * @param {string} req.query.key - The API key given from the game server to compare.
 * @param {string} req.query.name - The name of the player in the server.
 * @param {string} req.query.team - The team the player is on, either team1 or team2.
 * @param {int} req.query.kills - The amount of kills the player has.
 * @param {int} req.query.assists - The amount of assists the player has.
 * @param {int} req.query.deaths - The amount of deaths the player has.
 * @param {int} req.query.flashbang_assists - The amount of flashbang assists the player has.
 * @param {int} req.query.teamkills - The amount of team kills the player has.
 * @param {int} req.query.suicides - The amount of suicides the player has.
 * @param {int} req.query.damage - The total amount of damage the player has given over the map.
 * @param {int} req.query.headshot_kills - The total amount of headshots the player has given over the map.
 * @param {int} req.query.roundsplayed - The total amount of rounds played in the map.
 * @param {int} req.query.bomb_plants - The total amount of bomb plants played in the map.
 * @param {int} req.query.bomb_defuses - The total amount of bomb defuses played in the map.
 * @param {int} req.query.1kill_rounds - The total amount of 1 kill rounds the player has in the map.
 * @param {int} req.query.2kill_rounds - The total amount of 2 kill rounds the player has in the map.
 * @param {int} req.query.3kill_rounds - The total amount of 3 kill rounds the player has in the map.
 * @param {int} req.query.4kill_rounds - The total amount of 4 kill rounds the player has in the map.
 * @param {int} req.query.5kill_rounds - The total amount of 5 kill rounds the player has in the map.
 * @param {int} req.query.v1 - The total amount of 1v1s the player has in the map.
 * @param {int} req.query.v2 - The total amount of 1v2s the player has in the map.
 * @param {int} req.query.v3 - The total amount of 1v3s the player has in the map.
 * @param {int} req.query.v4 - The total amount of 1v4s the player has in the map.
 * @param {int} req.query.v5 - The total amount of 1v5s the player has in the map.
 * @param {int} req.query.firstkill_t - The total amount of first kills the player has in the map as terrorist.
 * @param {int} req.query.firstkill_ct - The total amount of first kills the player has in the map as counter-terrorist.
 * @param {int} req.query.firstdeath_t - The total amount of first deaths the player has in the map as terrorist.
 * @param {int} req.query.firstdeath_ct - The total amount of first deaths the player has in the map as counter-terrorist.
 */
router.post("/:match_id/map/:map_number/player/:steam_id/update", playerStatRateLimit, async (req, res, next) => {
  try {
    // Give from API call.
    let matchID = parseInt(req.params.match_id) || null;
    let mapNum = parseInt(req.params.map_number) || null;
    let steamId = req.params.steam_id || null;
    let playerName = req.query.name || null;
    let playerTeam = req.query.team || null;
    let playerKills = parseInt(req.query.kills) || null;
    let playerAssists = parseInt(req.query.assists) || null;
    let playerDeaths = parseInt(req.query.deaths) || null;
    let playerFBA = parseInt(req.query.flashbang_assists) || null;
    let playerTKs = parseInt(req.query.teamkills )|| null;
    let playerSuicide = parseInt(req.query.suicides) || null;
    let playerDamage = parseInt(req.query.damage) || null;
    let playerHSK = parseInt(req.query.headshot_kills) || null;
    let playerRoundsPlayed = parseInt(req.query.roundsplayed) || null;
    let playerBombsPlanted = parseInt(req.query.bomb_plants) || null;
    let playerBombsDefused = parseInt(req.query.bomb_defuses) || null;
    let player1k = parseInt(req.query['1kill_rounds']) || null;
    let player2k = parseInt(req.query['2kill_rounds']) || null;
    let player3k = parseInt(req.query['3kill_rounds']) || null;
    let player4k = parseInt(req.query['4kill_rounds']) || null;
    let player5k = parseInt(req.query['5kill_rounds']) || null;
    let player1v1 = parseInt(req.query.v1) || null;
    let player1v2 = parseInt(req.query.v2) || null;
    let player1v3 = parseInt(req.query.v3) || null;
    let player1v4 = parseInt(req.query.v4) || null;
    let player1v5 = parseInt(req.query.v5) || null;
    let playerFirstKillT = parseInt(req.query.firstkill_t) || null;
    let playerFirstKillCT = parseInt(req.query.firstkill_ct) || null;
    let playerFirstDeathCT = parseInt(req.query.firstdeath_ct) || null;
    let playerFirstDeathT = parseInt(req.query.firstdeath_t) || null;
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
    await withTransaction(db, async () =>{
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
        firstdeath_Ct: playerFirstDeathCT,
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
    res.status(500).json({message: err});
  }
});


/** Inner function - boilerplate transaction call.
 * @name withTransaction
 * @function
 * @inner
 * @memberof module:routes/legacy/api
 * @param {*} db - The database object.
 * @param {*} callback - The callback function that is operated on, usually a db.query()
 */
async function withTransaction(db, callback) {
  try {
    await db.beginTransaction();
    await callback();
    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  } /* finally {
    await db.close();
  } */
}

async function check_api_key(match_api_key, given_api_key, match_finished) {
    if (match_api_key.localeCompare(given_api_key) !== 0)
        throw "Not a correct API Key.";
    if (match_finished === 1)
        throw "Match is already finalized.";
    return;
}

module.exports = router;
