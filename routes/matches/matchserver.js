/**
 * @swagger
 * resourcePath: /matches
 * description: Express API router for matche server calls in get5.
 */
import { Router } from "express";

const router = Router();

import db from "../../db.js";

import Utils from "../../utility/utils.js";

import GameServer from "../../utility/serverrcon.js";

import config from "config";

import { existsSync, readdir } from "fs";

/**
 * @swagger
 *
 *  /matches/:match_id/forfeit/:winner_id:
 *   get:
 *     description: Forfeits a current match with a given team ID as the winner, if the match is running.
 *     parameters:
 *       - in: path
 *         name: winner_id
 *         schema:
 *           type: integer
 *         required: true
 *       - in: path
 *         name: match_id
 *         schema:
 *           type: integer
 *         required: true
 *     produces:
 *       - application/json
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        false
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else if (req.params.winner_id != 1 && req.params.winner_id != 2) {
        res
          .status(412)
          .json({ message: "Winner number invalid. Please provide 1 or 2." });
      } else {
        let currentMatchInfo =
          "SELECT server_id, team1_id, team2_id, is_pug FROM `match` WHERE id = ?";
        const matchRow = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let teamIdWinner =
          req.params.winner_id == 1
            ? matchRow[0].team1_id
            : matchRow[0].team2_id;
        let mapStatSql =
          "SELECT id FROM map_stats WHERE match_id=? AND map_number=0";
        const mapStat = await db.query(mapStatSql, [
          req.params.match_id,
        ]);
        let mapStatId;
        let newStatStmt = {
          start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          winner: teamIdWinner,
          team1_score: req.params.winner_id == 1 ? 16 : 0,
          team2_score: req.params.winner_id == 2 ? 16 : 0,
          match_id: req.params.match_id,
        };
        let matchUpdateStmt = {
          team1_score: req.params.winner_id == 1 ? 1 : 0,
          team2_score: req.params.winner_id == 2 ? 1 : 0,
          start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          winner: teamIdWinner,
        };
        if (!mapStat.length) {
          mapStatSql = "INSERT map_stats SET ?";
        } else {
          mapStatSql =
            "UPDATE map_stats SET ? WHERE match_id=? AND map_number=0";
        }
        let matchSql = "UPDATE `match` SET ? WHERE id=?";
        let serverUpdateSql = "UPDATE game_server SET in_use=0 WHERE id=?";
        if (!mapStat.length) {
          mapStatId = await db.query(mapStatSql, [newStatStmt]);
        }
        else
          await db.query(mapStatSql, [
            newStatStmt,
            req.params.match_id,
          ]);
        await db.query(matchSql, [
          matchUpdateStmt,
          req.params.match_id,
        ]);
        await db.query(serverUpdateSql, [matchRow[0].server_id]);
        if (matchRow[0].is_pug != null && matchRow[0].is_pug == 1) {
          await Utils.updatePugStats(
              req.params.match_id,
              !mapStat.length ? mapStatId.insertId : mapStat[0].id,
              matchRow[0].team1_id,
              matchRow[0].team2_id,
              teamIdWinner == 1 ? matchRow[0].team1_id : matchRow[0].team2_id
            );
        }
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchRow[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        if (!serverUpdate.endGet5Match()) {
          console.log(
            "Error attempting to stop match on game server side. Will continue."
          );
        }
        res.json({ message: "Match has been forfeitted successfully." });
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
    }
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {

        let currentMatchInfo =
          "SELECT server_id, team1_id, team2_id, is_pug FROM `match` WHERE id = ?";
        const matchRow = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let mapStatSql =
          "SELECT id FROM map_stats WHERE match_id=? AND map_number=0";
        const mapStat = await db.query(mapStatSql, [
          req.params.match_id,
        ]);
        let mapStatId;
        let newStatStmt = {
          end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          winner: null,
          team1_score: 0,
          team2_score: 0,
          match_id: req.params.match_id,
        };
        let matchUpdateStmt = {
          team1_score: 0,
          team2_score: 0,
          end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          winner: null,
          cancelled: 1,
        };
        if (!mapStat.length) {
          mapStatSql = "INSERT map_stats SET ?";
        } else {
          mapStatSql =
            "UPDATE map_stats SET ? WHERE match_id=? AND map_number=0";
        }
        let matchSql = "UPDATE `match` SET ? WHERE id=?";
        let serverUpdateSql = "UPDATE game_server SET in_use=0 WHERE id=?";
        if (!mapStat.length) {
          mapStatId = await db.query(mapStatSql, [newStatStmt]);
        }
        else
          await db.query(mapStatSql, [
            newStatStmt,
            req.params.match_id,
          ]);
        await db.query(matchSql, [
          matchUpdateStmt,
          req.params.match_id,
        ]);
        await db.query(serverUpdateSql, [matchRow[0].server_id]);
        if (matchRow[0].is_pug != null && matchRow[0].is_pug == 1) {
          await Utils.updatePugStats(
            req.params.match_id,
            !mapStat.length ? mapStatId.insertId : mapStat[0].id,
            matchRow[0].team1_id,
            matchRow[0].team2_id,
            null
          );
        }
        // Let the server cancel the match first, or attempt to?
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        if (matchRow[0].server_id != null) {
          const serverRow = await db.query(getServerSQL, [
            matchRow[0].server_id,
          ]);
          let serverUpdate = new GameServer(
            serverRow[0].ip_string,
            serverRow[0].port,
            serverRow[0].rcon_password
          );
          if (!serverUpdate.endGet5Match()) {
            console.log(
              "Error attempting to stop match on game server side. Will continue."
            );
          }
        }
        res.json({ message: "Match has been cancelled successfully." });
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/restart:
 *   get:
 *     description: Restarts the given match, provided it isn't finished and the user has the ability to do so. The user must either own the match or be an admin.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type: integer
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
  "/:match_id/restart/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo =
          "SELECT server_id, team1_id, team2_id, is_pug, api_key FROM `match` WHERE id = ?";
        const matchRow = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let mapStatSql =
          "SELECT id FROM map_stats WHERE match_id=?";
        const mapStat = await db.query(mapStatSql, [
          req.params.match_id,
        ]);
        let playerStatSql =
          "SELECT id FROM player_stats WHERE match_id=?";
        const playerStats = await db.query(playerStatSql, [
          req.params.match_id,
        ]);
        let vetoSql =
          "SELECT id FROM veto WHERE match_id=?";
        const vetoData = await db.query(vetoSql, [
          req.params.match_id,
        ]);
        let matchUpdateStmt = {
          start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
          cancelled: 0,
          end_time: null
        };
        if (mapStat.length) {
          mapStatSql = "DELETE FROM map_stats WHERE match_id = ?";
          await db.query(mapStatSql, [req.params.match_id]);
        }
        if (playerStats.length) {
          playerStatSql = "DELETE FROM player_stats WHERE match_id = ?";
          await db.query(playerStatSql, [req.params.match_id]);
        }
        if (vetoData.length) {
          vetoSql = "DELETE FROM veto WHERE match_id = ?";
          await db.query(vetoSql, [req.params.match_id]);
        }
        // Let the server cancel the match first, or attempt to?
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        if (matchRow[0].server_id != null) {
          const serverRow = await db.query(getServerSQL, [
            matchRow[0].server_id,
          ]);
          let serverUpdate = new GameServer(
            serverRow[0].ip_string,
            serverRow[0].port,
            serverRow[0].rcon_password
          );
          if (!await serverUpdate.endGet5Match()) {
            console.log(
              "Error attempting to stop match on game server side. Will continue."
            );
          }
          await serverUpdate.prepareGet5Match(
            config.get("server.apiURL")  +
            "/matches/" +
            req.params.match_id +
            "/config",
            matchRow[0].api_key
          );
          let matchSql = "UPDATE `match` SET ? WHERE id=?";
          await db.query(matchSql, [
            matchUpdateStmt,
            req.params.match_id,
          ]);
        }
        res.json({ message: "Match has been restarted successfully." });
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let strRconCommand = req.body[0].rcon_command;
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        let getServerSQL =
          "SELECT ip_string, port, rcon_password, user_id FROM game_server WHERE id=?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        if (
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
          serverRow[0].rcon_password
        );
        try {
          let rconResponse = await serverUpdate.sendRconCommand(
            strRconCommand
          );
          res.json({
            message: "Command Sent Successfully.",
            response: rconResponse,
          });
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              steam_id:
 *                type: string
 *                description: The formatted Steam ID of a user. Can be url, steam64, ID3, vanity URL.
 *              team_id:
 *                type: string
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        let steamID = await Utils.getSteamPID(req.body[0].steam_id);
        let teamId = req.body[0].team_id;
        let nickName = req.body[0].nickname;
        if (teamId != "team1" && teamId != "team2") {
          res
            .status(400)
            .json({ message: "Please choose either team1 or team2." });
          return;
        }
        try {
          let rconResponse = await serverUpdate.addUser(
            teamId,
            steamID,
            nickName
          );
          res.json({
            message: "User added successfully.",
            response: rconResponse,
          });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/addcoach:
 *   put:
 *     description: Sends an add coach commamd to a given team.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type: integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              steam_id:
 *                type: string
 *                description: The formatted Steam ID of a user. Can be url, steam64, ID3, vanity URL.
 *              team_id:
 *                type: string
 *                description: Either the first or second team in the match, team1 or team2.
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
  "/:match_id/addcoach/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        let steamID = await Utils.getSteamPID(req.body[0].steam_id);
        let teamId = req.body[0].team_id;
        if (teamId != "team1" && teamId != "team2") {
          res
            .status(400)
            .json({ message: "Please choose either team1 or team2." });
          return;
        }
        try {
          let rconResponse = await serverUpdate.addCoach(
            teamId,
            steamID
          );
          res.json({
            message: "User added successfully.",
            response: rconResponse,
          });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        let steamID = await Utils.getSteamPID(req.body[0].steam_id);
        try {
          let rconResponse = await serverUpdate.addUser("spec", steamID);
          res.json({
            message: "User added to spectator successfully.",
            response: rconResponse,
          });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/removeuser:
 *   put:
 *     description: Sends a get5_removeplayer command to the game server with a given steam ID.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type: integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              steam_id:
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
  "/:match_id/removeuser/",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        let steamID = await Utils.getSteamPID(req.body[0].steam_id);
        try {
          let rconResponse = await serverUpdate.removeUser(steamID);
          res.json({
            message: "User removed from match successfully.",
            response: rconResponse,
          });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        try {
          let rconResponse = await serverUpdate.getBackups();
          res.json({ message: "Backups retrieved.", response: rconResponse });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
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
 *            type: integer
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
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        let getServerSQL =
          "SELECT ip_string, port, rcon_password FROM game_server WHERE id=?";
        const serverRow = await db.query(getServerSQL, [
          matchServerId[0].server_id,
        ]);
        let serverUpdate = new GameServer(
          serverRow[0].ip_string,
          serverRow[0].port,
          serverRow[0].rcon_password
        );
        if (req.body[0].backup_name == null) {
          res
            .status(412)
            .json({ message: "Please provide the backup name." });
          return;
        }
        try {
          let rconResponse = await serverUpdate.restoreBackup(
            req.body[0].backup_name
          );
          res.json({ message: "Restored backup.", response: rconResponse });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/backup/remote:
 *   post:
 *     description: Runs a backup stored on the API remotely to a specified game server, provided it is available.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type: integer
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              server_id:
 *                type: integer
 *                description: The ID of the server that you wish to restore to.
 *              backup_file:
 *                type: string
 *                description: The name of the backup file. This can be retrieved via a GET.
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
  "/:match_id/backup/remote",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let newServerId = req.body[0].server_id;
        let currentMatchInfo = "SELECT server_id FROM `match` WHERE id = ?";
        let newServerInfo =
          "SELECT id, user_id, ip_string, port, rcon_password, public_server FROM game_server WHERE id = ?";
        let configString = req.body[0].backup_file;
        const matchServerId = await db.query(
          currentMatchInfo,
          req.params.match_id
        );
        const newServerRow = await db.query(newServerInfo, [
          newServerId
        ]);
        // Check to see if new server row matches for access purposes.
        if (!Utils.adminCheck(req.user)) {
          if (newServerRow[0].user_id != req.user.id && !newServerRow[0].public_server) {
            req.status(403).json({ message: "User is not authorized to perform action." });
            return;
          }
        }

        // Check to see if file exists in our public directory.
        if (!existsSync(`public/backups/${req.params.match_id}/${configString}`)) {
          res
            .status(412)
            .json({ message: "Backup name invalid." });
          return;
        }
        let serverUpdate = new GameServer(
          newServerRow[0].ip_string,
          newServerRow[0].port,
          newServerRow[0].rcon_password
        );
        try {
          if (serverUpdate.isGet5Available()) {
            let rconResponse = await serverUpdate.restoreBackupFromURL(
              config.get("server.apiURL") + `/backups/${req.params.match_id}/${configString}`
            );
            currentMatchInfo = "UPDATE `match` SET server_id = ? WHERE id = ?";
            await db.query(currentMatchInfo, [req.params.match_id, newServerId]);
            currentMatchInfo = "UPDATE game_server SET in_use = 0 WHERE id = ?";
            await db.query(currentMatchInfo, [matchServerId[0].server_id]);
            res.json({ message: "Restored backup.", response: rconResponse });
          } else {
            res
              .status(412)
              .json({ message: "Match is already in progress on chosen server, or get5 is unavailable." });
            return;
          }
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error on game server.", response: err });
        } finally {
          return;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error on game server.", response: err });
    }
  }
);

/**
 * @swagger
 *
 *  /matches/:match_id/backup/remote:
 *   get:
 *     description: Retrieves the name of backups available for a match on the API.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: match_id
 *         description: The current matches identification number.
 *         schema:
 *            type: integer
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
  "/:match_id/backup/remote",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    try {
      let errMessage = await Utils.getUserMatchAccess(
        req.params.match_id,
        req.user,
        true
      );
      if (errMessage != null) {
        res.status(errMessage.status).json({ message: errMessage.message });
        return;
      } else {
        let fileArray = [];
        readdir(`public/backups/${req.params.match_id}`, function (err, files) {
          //handling error
          if (err) {
            console.error(err);
            return res.status(404).json({ message: "No backups found.", response: [] });;
          }
          //listing all files using forEach
          files.forEach(function (file) {
            console.log(file);
            // Do whatever you want to do with the file
            fileArray.push(file)
          });
          res.json({ message: "Backups retrieved.", response: fileArray });
        });
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "API Error.", response: err });
    }
  }
);

export default router;
