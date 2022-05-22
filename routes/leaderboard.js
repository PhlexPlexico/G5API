/** Express API router for leaderboards in get5.
 * @module routes/leaderboard
 * @requires express
 * @requires db
 */

/**
 * @swagger
 * resourcePath: /leaderboard
 * description: Leaderboard calls from the database.
 */
 import { Router } from "express";

 const router = Router();
 
 import db from "../db.js";
 
 import Utils from "../utility/utils.js";
 
 /**
  * @swagger
  *
  * components:
  *   schemas:
  *     SimpleResponse:
  *       type: object
  *       properties:
  *         message:
  *           type: string
  *   responses:
  *     BadRequest:
  *       description: Bad request, information not provided.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     NotFound:
  *       description: The specified resource was not found.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     Unauthorized:
  *       description: Unauthorized.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     Error:
  *       description: Error
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  */
 
 /**
  * @swagger
  *
  * /leaderboard/:
  *   get:
  *     description: Get lifetime leaderboard of teams
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/SimpleResponse'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/", async (req, res) => {
   try {
     let leaderboard = await getTeamLeaderboard();
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err.toString() });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/players:
  *   get:
  *     description: Get lifetime leaderboard for players
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/SimpleResponse'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/players", async (req, res) => {
   try {
     let leaderboard = await getPlayerLeaderboard();
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/players/pug:
  *   get:
  *     description: Get lifetime leaderboard for players in pickup games.
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/SimpleResponse'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/players/pug", async (req, res) => {
   try {
     let leaderboard = await getPlayerLeaderboard(null, true);
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/players/:season_id:
  *   get:
  *     description: Seasonal leaderboard for players
  *     produces:
  *       - application/json
  *     parameters:
  *       - name: season_id
  *         required: true
  *         schema:
  *          type: string
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/SimpleResponse'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/players/:season_id", async (req, res) => {
   try {
     let seasonId = req.params.season_id;
     let leaderboard = await getPlayerLeaderboard(seasonId);
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/:season_id:
  *   get:
  *     description: Seasonal leaderboard for teams
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     parameters:
  *       - name: season_id
  *         required: true
  *         schema:
  *          type: string
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/SimpleResponse'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/:season_id", async (req, res) => {
   try {
     let seasonId = req.params.season_id;
     let leaderboard = await getTeamLeaderboard(seasonId);
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /** Function to get the current team leaderboard standings in a season, or all time.
  * @function
  * @memberof module:routes/leaderboard
  * @param {string} [seasonId=null] - Season ID to filter.
  * @inner */
 const getTeamLeaderboard = async (seasonId = null) => {
   try {
     /* Logic:
      * 1. Get all matches.
      * 2. Loops through each match id, and get all map stats.
      * 3. Store all map stats for each unique team.
      * 4. Return all stats. Doesn't matter if sorted, front-end should take care of it?
      */
     let allMatches = null;
     let winningRounds,
       losingRounds = 0;
     let teamStandings = [];
     let matchSql = "";
     if (!seasonId) {
       matchSql =
         "SELECT id, team1_id, team2_id FROM `match` WHERE end_time IS NOT NULL AND winner IS NOT NULL AND cancelled = false";
       allMatches = await db.query(matchSql);
     } else {
       matchSql =
         "SELECT id, team1_id, team2_id FROM `match` WHERE end_time IS NOT NULL AND winner IS NOT NULL AND cancelled = FALSE AND season_id = ?";
       allMatches = await db.query(matchSql, [seasonId]);
     }
     for (let match of allMatches) {
       let mapStatSql =
         "SELECT * FROM map_stats WHERE match_id = ? AND winner IS NOT NULL";
       let teamSelectSql = "SELECT id, name FROM team WHERE id = ?";
       let winningTeam, losingTeam;
       const mapStats = await db.query(mapStatSql, match.id);
       for (let stats of mapStats) {
         winningRounds = 0;
         losingRounds = 0;
         winningTeam = await db.query(teamSelectSql, [stats.winner]);
         // If we don't have a team don't report to the team table.
         // This means that it was a PUG and not an actual team.
         if (winningTeam[0] == null) {
           continue;
         }
         if (winningTeam[0].id === match.team1_id) {
           losingTeam = await db.query(teamSelectSql, [match.team2_id]);
         } else {
           losingTeam = await db.query(teamSelectSql, [match.team1_id]);
         }
         // If winners or losers are deleted, continue on.
         if (losingTeam[0] == null) {
           continue;
         }
         if (winningTeam[0].id === match.team1_id) {
           winningRounds += stats.team1_score;
           losingRounds += stats.team2_score;
         } else {
           winningRounds += stats.team2_score;
           losingRounds += stats.team1_score;
         }
         let winName = winningTeam[0].name;
         let loseName = losingTeam[0].name;
         // Instantiate the object, needed only once.
         if (!teamStandings.some((el) => el.name === winName)) {
           teamStandings.push({
             name: winName,
             wins: 0,
             losses: 0,
             rounddiff: 0,
           });
         }
         if (!teamStandings.some((el) => el.name === loseName)) {
           teamStandings.push({
             name: loseName,
             wins: 0,
             losses: 0,
             rounddiff: 0,
           });
         }
         let winners = teamStandings.find((team) => {
           return team.name === winName;
         });
         winners.wins += 1;
         winners.rounddiff += winningRounds - losingRounds;
         let losers = teamStandings.find((team) => {
           return team.name === loseName;
         });
         losers.losses += 1;
         losers.rounddiff += losingRounds - winningRounds;
       }
     }
     return teamStandings;
   } catch (err) {
     console.log(err);
     throw err;
   }
 };
 
 /** Function to get the current player leaderboard standings in a season, or all time.
  * @function
  * @memberof module:routes/leaderboard
  * @param {string} [seasonId=null] - Season ID to filter.
  */
 const getPlayerLeaderboard = async (seasonId = null, pug = false) => {
   let allPlayers = [];
   let playerStats;
   /* Logic:
    * 1. Get all player values where match is not cancelled or forfeit.
    * 2. Grab raw values, and calculate things like HSP and KDR for each user. Get names and cache 'em even.
    * 3. Insert into list of objects for each user.
    */
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
     WHERE   match_id IN (
         SELECT  id
         FROM    \`match\`
         WHERE   cancelled=0
         AND     is_pug=` +
     pug +
     `
     )
     GROUP BY steam_id, name`;
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
     WHERE   match_id IN (
         SELECT  id
         FROM    \`match\`
         WHERE   cancelled=0
         AND season_id = ?
         AND     is_pug=` +
     pug +
     `
     )
     GROUP BY steam_id, name`;
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
   if (!seasonId) playerStats = await db.query(playerStatSql);
   else playerStats = await db.query(playerStatSqlSeasons, [seasonId]);
   for (let player of playerStats) {
     // Players can have multiple names. Avoid collision by combining everything, then performing averages.
     if (!allPlayers.some((el) => el.steamId === player.steam_id)) {
       if (!seasonId) numWins = await db.query(winSql, [player.steam_id, pug]);
       else
         numWins = await db.query(winSqlSeasons, [
           player.steam_id,
           seasonId,
           pug,
         ]);
       allPlayers.push({
         steamId: player.steam_id,
         name:
           player.name == null
             ? await Utils.getSteamName(player.steam_id)
             : player.name.replace('/"/g', '\\"'),
         kills: parseFloat(player.kills),
         deaths: parseFloat(player.deaths),
         assists: parseFloat(player.assists),
         k1: parseFloat(player.k1),
         k2: parseFloat(player.k2),
         k3: parseFloat(player.k3),
         k4: parseFloat(player.k4),
         k5: parseFloat(player.k5),
         v1: parseFloat(player.v1),
         v2: parseFloat(player.v2),
         v3: parseFloat(player.v3),
         v4: parseFloat(player.v4),
         v5: parseFloat(player.v5),
         trp: parseFloat(player.trp),
         fba: parseFloat(player.fba),
         total_damage: parseFloat(player.dmg),
         hsk: parseFloat(player.hsk),
         hsp:
           parseFloat(player.kills) === 0
             ? 0
             : (
                 (parseFloat(player.hsk) / parseFloat(player.kills)) *
                 100
               ).toFixed(2),
         average_rating: Utils.getRating(
           parseFloat(player.kills),
           parseFloat(player.trp),
           parseFloat(player.deaths),
           parseFloat(player.k1),
           parseFloat(player.k2),
           parseFloat(player.k3),
           parseFloat(player.k4),
           parseFloat(player.k5)
         ),
         wins: numWins[0].wins,
         total_maps: player.totalMaps,
         enemies_flashed: parseFloat(player.eflash),
         friendlies_flashed: parseFloat(player.fflash),
         util_damage: parseFloat(player.utildmg),
       });
     } else {
       let collisionPlayer = allPlayers.find((user) => {
         return user.steamId === player.steam_id;
       });
       // Update name, or concat name?
       if (player.name == "")
         collisionPlayer.name = (collisionPlayer.name + "/" + player.name)
           .replace(/\/+$/, "")
           .replace('/"/g', '\\"');
       else
         collisionPlayer.name = player.name
           .replace(/\/+$/, "")
           .replace('/"/g', '\\"');
       collisionPlayer.kills += parseFloat(player.kills);
       collisionPlayer.deaths += parseFloat(player.deaths);
       collisionPlayer.assists += parseFloat(player.assists);
       collisionPlayer.k1 += parseFloat(player.k1);
       collisionPlayer.k2 += parseFloat(player.k2);
       collisionPlayer.k3 += parseFloat(player.k3);
       collisionPlayer.k4 += parseFloat(player.k4);
       collisionPlayer.k5 += parseFloat(player.k5);
       collisionPlayer.v1 += parseFloat(player.v1);
       collisionPlayer.v2 += parseFloat(player.v2);
       collisionPlayer.v3 += parseFloat(player.v3);
       collisionPlayer.v4 += parseFloat(player.v4);
       collisionPlayer.v5 += parseFloat(player.v5);
       collisionPlayer.trp += parseFloat(player.trp);
       collisionPlayer.fba += parseFloat(player.fba);
       collisionPlayer.hsk += parseFloat(player.hsk);
       collisionPlayer.total_damage += parseFloat(player.dmg);
       collisionPlayer.total_maps += parseFloat(player.totalMaps);
       collisionPlayer.hsp =
         parseFloat(collisionPlayer.kills) === 0
           ? 0
           : (
               (parseFloat(collisionPlayer.hsk) /
                 parseFloat(collisionPlayer.kills)) *
               100
             ).toFixed(2);
       collisionPlayer.average_rating = Utils.getRating(
         parseFloat(collisionPlayer.kills),
         parseFloat(collisionPlayer.trp),
         parseFloat(collisionPlayer.k1),
         parseFloat(collisionPlayer.k2),
         parseFloat(collisionPlayer.k3),
         parseFloat(collisionPlayer.k4),
         parseFloat(collisionPlayer.k5)
       );
       collisionPlayer.enemies_flashed += parseFloat(player.eflash);
       collisionPlayer.friendlies_flashed += parseFloat(player.fflash);
       collisionPlayer.util_damage += parseFloat(player.utildmg);
     }
   }
   return allPlayers;
 };
 export default router;
 
