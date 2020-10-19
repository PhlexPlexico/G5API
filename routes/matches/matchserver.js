 /**
 * @swagger
 * resourcePath: /matches
 * description: Express API router for matche server calls in get5.
 */
const express = require("express");

const router = express.Router();

const db = require("../../db");

const randString = require("randomstring");

const Utils = require("../../utility/utils");

const GameServer = require("../../utility/serverrcon");


/**
 * @swagger
 *
 *  /matches/:match_id/forfeit/:winner_id:
 *   get:
 *     description: Forfeits a current match with a given team ID as the winner, if the match is running.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: winner_id
 *         description: The winning team of either 1 or 2.
 *         required: true
 *         schema:
 *          type: integer
 *       - name: match_id
 *         description: The current match.
 *         schema:
 *            type:integer
 *         
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       412:
 *         $ref: '#/components/responses/MatchInvalidData'
 */
router.get(
  "/:match_id/forfeit/:winner_id",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (!Utils.superAdminCheck(req.user)) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else if (req.params.winner_id != 1 && req.params.winner_id != 2) {
      res
        .status(412)
        .json({ message: "Winner number invalid. Please provide 1 or 2." });
    } else {
      let teamIdWinner =
        req.params.winner_id == 1 ? matchRow[0].team1_id : matchRow[0].team2_id;
      let mapStatSql =
        "SELECT * FROM map_stats WHERE match_id=? AND map_number=0";
      const mapStat = await db.query(mapStatSql, [req.params.match_id]);
      let newStatStmt = {
        start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
        end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
        winner: teamIdWinner,
        team1_score: req.params.winner_id == 1 ? 16 : 0,
        team2_score: req.params.winner_id == 2 ? 16 : 0,
      };
      let matchUpdateStmt = {
        team1_score: req.params.winner_id == 1 ? 1 : 0,
        team2_score: req.params.winner_id == 2 ? 1 : 0,
        start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
        end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
        winner: teamIdWinner,
      };
      if (mapStat.length == 0) {
        mapStatSql = "INSERT map_stats SET ?";
      } else {
        mapStatSql = "UPDATE map_stats SET ? WHERE match_id=? AND map_number=0";
      }
      let matchSql = "UPDATE `match` SET ? WHERE id=?";
      let serverUpdateSql = "UPDATE game_server SET in_use=0 WHERE id=?";
      await db.withTransaction(async () => {
        if (mapStat.length == 0) await db.query(mapStatSql, [newStatStmt]);
        else await db.query(mapStatSql, [newStatStmt, req.params.match_id]);
        await db.query(matchSql, [matchUpdateStmt]);
        await db.query(serverUpdateSql, [matchRow[0].server_id]);
      });
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      if (!serverUpdate.endGet5Match()) {
        console.log(
          "Error attempting to stop match on game server side. Will continue."
        );
      }
    }
    res.json({ message: "Match has been forfeitted successfully." });
    return;
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/cancel:
 *   get:
 *     description: Cancels the given match, provided it isn't finished and the user has the ability to do so. The user must either own the match or be an admin.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *         
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  "/:match_id/cancel/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let mapStatSql =
        "SELECT * FROM map_stats WHERE match_id=? AND map_number=0";
      const mapStat = await db.query(mapStatSql, [req.params.match_id]);
      let newStatStmt = {
        end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
        winner: null,
        team1_score: 0,
        team2_score: 0,
      };
      let matchUpdateStmt = {
        team1_score: 0,
        team2_score: 0,
        end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
        winner: null,
      };
      if (mapStat.length == 0) {
        mapStatSql = "INSERT map_stats SET ?";
      } else {
        mapStatSql = "UPDATE map_stats SET ? WHERE match_id=? AND map_number=0";
      }
      let matchSql = "UPDATE `match` SET ? WHERE id=?";
      let serverUpdateSql = "UPDATE game_server SET in_use=0 WHERE id=?";
      await db.withTransaction(async () => {
        if (mapStat.length == 0) await db.query(mapStatSql, [newStatStmt]);
        else await db.query(mapStatSql, [newStatStmt, req.params.match_id]);
        await db.query(matchSql, [matchUpdateStmt]);
        await db.query(serverUpdateSql, [matchRow[0].server_id]);
      });
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      if (!serverUpdate.endGet5Match()) {
        console.log(
          "Error attempting to stop match on game server side. Will continue."
        );
      }
      res.json({ message: "Match has been cancelled successfully." });
      return;
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/rcon:
 *   put:
 *     description: Sends out an RCON Command to the server, and returns the response if retrieved. Super admins can only use this, as you can retrieve RCON Passwords using this.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              rcon_command:
 *                type: string
 *                description: The rcon command that the user has sent in.
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put(
  "/:match_id/rcon/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    let strRconCommand = req.body[0].rcon_command;
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password, user_id FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      if(
        !Utils.superAdminCheck(req.user) &&
        serverRow[0].user_id != req.user.id  
      ) {
        res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
        return;
      }
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      try {
        let rconResponse = await serverUpdate.sendRconCommand(strRconCommand);
        res.json({
          message: "Command Sent Successfully.",
          response: rconResponse,
        });
        //TODO: Provide audit tables and insert commands into there?
        return;
      } catch (err) {
        console.error(
          "Error attempting to send RCON Command. Please check server log."
        );
        res.status(500).json({
          message:
            "Error attempting to send RCON Command. Please check server log.",
        });
        return;
      }
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/pause:
 *   get:
 *     description: Sends the sm_pause command to a given match.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *         
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  "/:match_id/pause/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );

      let rconResponse = await serverUpdate.pauseMatch();
      if (rconResponse) {
        res.json({ message: "Match paused." });
      } else {
        res.json({
          message: "Match not paused. Check server log for details.",
        });
      }
      return;
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/unpause:
 *   get:
 *     description: Sends the sm_unpause command to a given match.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *         
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  "/:match_id/unpause/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );

      let rconResponse = await serverUpdate.unpauseMatch();
      if (rconResponse) {
        res.json({ message: "Match unpaused." });
      } else {
        res.json({
          message: "Match not unpaused. Check server log for details.",
        });
      }
      return;
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/adduser:
 *   put:
 *     description: Sends an add user commamd to a given team.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              user_id:
 *                type: string
 *                description: The formatted Steam ID of a user. Can be url, steam64, ID3, vanity URL.
 *              team_id:
 *                type: integer
 *                description: Either the first or second team in the match, team1 or team2.
 *              nickname:
 *                type: string
 *                description: Optional nickname for the user being added into the match.
 *                required: false
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put(
  "/:match_id/adduser/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      let steamID = Utils.getSteamPID(req.body[0].steam_id);
      let teamId = req.body[0].team_id;
      let nickName = req.body[0].nickname;
      if(teamId != "team1" || teamId != "team2"){
        res.status(400).json({message: "Please choose either team1 or team2." });
        return;
      }
      try{
        let rconResponse = await serverUpdate.addUser(teamId, steamID, nickName);
        res.json({ message: "User added successfully.", response: rconResponse });
      }catch(err){
        res.status(500).json({ message: "Error on game server.", response: err });
      } finally{
        return;
      }
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/addspec:
 *   put:
 *     description: Sends an add player to spectator command.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              user_id:
 *                type: string
 *                description: The formatted Steam ID of a user. Can be url, steam64, ID3, vanity URL.
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put(
  "/:match_id/addspec/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      let steamID = Utils.getSteamPID(req.body[0].steam_id);
      try{
        let rconResponse = await serverUpdate.addUser("spec", steamID);
        res.json({ message: "User added to spectator successfully.", response: rconResponse });
      }catch(err){
        res.status(500).json({ message: "Error on game server.", response: err });
      } finally{
        return;
      }
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/backup:
 *   get:
 *     description: Retrieves the name of backups on the game server.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *         
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  "/:match_id/backup/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      try{
        let rconResponse = await serverUpdate.getBackups();
        res.json({ message: "Backups retrieved.", response: rconResponse });
      }catch(err){
        res.status(500).json({ message: "Error on game server.", response: err });
      } finally{
        return;
      }
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/backup:
 *   post:
 *     description: Runs a backup file on the game server.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type:integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              backup_name:
 *                type: string
 *                description: Filename of the backup located on the game server.
 *     tags:
 *       - matches
 *     responses:
 *       200:
 *         description: Match response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       401:
 *         $ref: '#/components/responses/MatchFinished'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       412:
 *         $ref: '#/components/responses/MatchInvalidData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post(
  "/:match_id/backup/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let currentMatchInfo =
      "SELECT user_id, server_id, cancelled, forfeit, end_time, team1_id, team2_id FROM `match` WHERE id = ?";
    const matchRow = await db.query(currentMatchInfo, req.params.match_id);
    if (matchRow.length === 0) {
      res.status(404).json({ message: "No match found." });
      return;
    } else if (
      !Utils.adminCheck(req.user) &&
      req.user.id != matchRow[0].user_id
    ) {
      res
        .status(403)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else if (
      matchRow[0].cancelled == 1 ||
      matchRow[0].forfeit == 1 ||
      matchRow[0].end_time != null
    ) {
      res.status(401).json({ message: "Match is already finished." });
      return;
    } else {
      let getServerSQL =
        "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
      const serverRow = await db.query(getServerSQL, [matchRow[0].server_id]);
      let serverUpdate = new GameServer(
        serverRow[0].ip_string,
        serverRow[0].port,
        null,
        serverRow[0].rcon_password
      );
      if(req.body[0].backup_name == null){
        res.status(412).json({ message: "Please provide the backup name." });
        return;
      }
      try{
        let rconResponse = await serverUpdate.restoreBackup(req.body[0].backup_name);
        res.json({ message: "Restored backup.", response: rconResponse });
      }catch(err){
        res.status(500).json({ message: "Error on game server.", response: err });
      } finally{
        return;
      }
    }
  }
);

module.exports = router;
