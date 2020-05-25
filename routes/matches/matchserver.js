/** Express API router for users in get5.
 * @module routes/matches
 * @requires express
 * @requires db
 */
const express = require("express");

/** Express module
 * @const
 */

const router = express.Router();
/** Database module.
 * @const
 */

const db = require("../../db");

/** Random string generator for API keys.
 * @const
 */
const randString = require("randomstring");

/** Utility class for various methods used throughout.
 * @const */
const Utils = require("../../utility/utils");

/** RCON Class for use of server integration.
 * @const */
const GameServer = require("../../utility/serverrcon");


/** GET - Forfeits a match and gives the win to given team 1 or team 2.
 * @name router.get("/forfeit/:winnerID)
 * @memberof module:routes/matches
 * @function
 * @param {int} req.params.winner_id - The ID representing the team that won via forfeit. Either team 1 or team 2.
 * @param {int} req.params.match_id - The ID of the match to forfeit.
 * @param {int} req.user.id - The ID of the user creating this request.
 *
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
          .status(401)
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
          .status({ message: "Winner number invalid. Please provide 1 or 2." });
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
          await db.query(mapStatSql, [newStatStmt]);
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
    }
);



module.exports = router;