/** Utilities class for help with basic functions.
 * @module utils
 */

/** AES Module for Encryption/Decryption
 * @const
 */
import pkg from 'aes-js';
const { utils, ModeOfOperation } = pkg;

/** Crypto for assigning random  */
import { randomBytes } from "crypto";

/** Config to get database key.
 * @const
 */
import config from "config";

/** Steam API Handler for custom URLs
 * @const
 */
import SteamURLResolver from "steamapi";
const SteamAPI = new SteamURLResolver(config.get("server.steamAPIKey"));
/** Steam ID Handler for other IDs.
 * @const
 */
import { ID } from "@node-steam/id";

import db from "../db.js";

class Utils {
  /** Function to get an HLTV rating for a user.
   * @function
   * @memberof module:utils
   * @param {integer} [kills=0] - Amount of kills.
   * @param {integer} [roundsplayed=0] - Amount of rounds played.
   * @param {integer} [deaths=0] - Amount of deaths.
   * @param {integer} [k1=0] - Amount of 1-kill rounds.
   * @param {integer} [k2=0] - Amount of 2-kill rounds.
   * @param {integer} [k3=0] - Amount of 3-kill rounds.
   * @param {integer} [k4=0] - Amount of 4-kill rounds.
   * @param {integer} [k5=0] - Amount of 5-kill rounds.
   * @function
   * @static */
  static getRating(
    kills = 0,
    roundsplayed = 0,
    deaths = 0,
    k1 = 0,
    k2 = 0,
    k3 = 0,
    k4 = 0,
    k5 = 0
  ) {
    try {
      let AverageKPR = 0.679;
      let AverageSPR = 0.317;
      let AverageRMK = 1.277;
      let KillRating =
        roundsplayed === 0 ? 0 : kills / roundsplayed / AverageKPR;
      let SurvivalRating =
        roundsplayed === 0
          ? 0
          : (roundsplayed - deaths) / roundsplayed / AverageSPR;
      let killcount = k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5;
      let RoundsWithMultipleKillsRating =
        roundsplayed === 0 ? 0 : killcount / roundsplayed / AverageRMK;
      let rating =
        (KillRating + 0.7 * SurvivalRating + RoundsWithMultipleKillsRating) /
        2.7;

      return rating.toFixed(2);
    } catch (err) {
      console.log("HELPER getRating Failed -- " + err);
      return 0;
    }
  }

  /** Inner function - Supports encryption and decryption for the database keys to get server RCON passwords.
   * @name decrypt
   * @function
   * @inner
   * @memberof module:utils
   * @param {string} source - The source to be decrypted.
   */
  static decrypt(source) {
    try {
      if (source === null) return;
      let byteSource = utils.hex.toBytes(source.substring(32));
      let IV = utils.hex.toBytes(source.substring(0, 32));
      let key = utils.utf8.toBytes(config.get("server.dbKey"));
      let aesCbc = new ModeOfOperation.ofb(key, IV);
      let decryptedBytes = aesCbc.decrypt(byteSource);
      let decryptedText = utils.utf8.fromBytes(decryptedBytes);
      return decryptedText;
    } catch (err) {
      console.error(err);
      // fail silently.
      return null;
    }
  }

  /** Inner function - Supports encryption and decryption for the database keys to get server RCON passwords.
   * @name encrypt
   * @function
   * @inner
   * @memberof module:utils
   * @param {string} source - The source to be decrypted.
   */
  static encrypt(source) {
    try {
      if (source === null) return;

      let byteSource = utils.utf8.toBytes(source);
      let IV = randomBytes(16);
      let key = utils.utf8.toBytes(config.get("server.dbKey"));
      let aesCbc = new ModeOfOperation.ofb(key, IV);
      let encryptedBytes = aesCbc.encrypt(byteSource);
      let encryptedHex = utils.hex.fromBytes(encryptedBytes);
      let hexIV = utils.hex.fromBytes(IV);
      encryptedHex = hexIV + encryptedHex;
      return encryptedHex;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
  /** Ensures the user was authenticated through steam OAuth.
   * @function
   * @memberof module:utils
   * @inner */
  static async ensureAuthenticated(req, res, next) {
    // Check the user based on API.
    const apiKey = req.get("user-api") || req.body[0]?.user_api;
    if (apiKey) {
      let sqlQuery = "SELECT * FROM user WHERE id = ?";
      const ourUser = await db.query(sqlQuery, apiKey.split(":")[0]);
      if (ourUser.length > 0) {
        let uncDb = Utils.decrypt(ourUser[0].api_key);
        if (uncDb == apiKey.split(":")[1]) {
          let curUser = {
            steam_id: ourUser[0].steam_id,
            name: ourUser[0].name,
            super_admin: ourUser[0].super_admin,
            admin: ourUser[0].admin,
            id: ourUser[0].id,
            small_image: ourUser[0].small_image,
            medium_image: ourUser[0].medium_image,
            large_image: ourUser[0].large_image,
          };
          req.user = curUser;
          return next();
        }
      }
    }
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/auth/steam");
  }

  /** Checks if a user is an admin in the system during their session.
   * @function
   * @memberof module:utils
   * @inner
   * @name adminCheck
   * @param {user} User - the users session object.
   */
  static adminCheck(user) {
    if (user) return user.super_admin === 0 && user.admin === 0 ? false : true;
    else return false;
  }

  /** Checks if a user is a super admin in the system during their session.
   * @function
   * @memberof module:utils
   * @inner
   * @name superAdminCheck
   * @param {user} User - the users session object.
   */
  static superAdminCheck(user) {
    if (user) return user.super_admin === 0 ? false : true;
    else return false;
  }

  /** Converts a Steam ID to Steam64.
   * @function
   * @memberof module:utils
   * @inner
   * @name convertToSteam64
   * @param {String} anySteamID - String value of a Steam ID.
   * @returns A string representing a 64bit steam ID, or nothing if the profile is not found.
   */
  static async convertToSteam64(anySteamID) {
    const steam64ID = new ID(anySteamID);
    if (steam64ID.isValid() && steam64ID.getType() == "INDIVIDUAL")
      return steam64ID.get64();
    else return "";
  }
  /** Retrieves a Steam64 value from a given value.
   * @function
   * @memberof module:utils
   * @inner
   * @name getSteamPID
   * @param {String} authString - String value of a steam username/profile/url/steamID.
   * @returns A Steam64 value in string form, or nothing.
   */
  static async getSteamPID(authString) {
    // Remove any https tags, as they aren't needed.
    authString = authString.replace(new RegExp("^(http|https)://", "i"), "");
    if (authString.includes("steamcommunity.com/id/")) {
      let steamID = await SteamAPI.resolve(authString);
      return steamID;
    } else if (authString.includes("steamcommunity.com/profiles/")) {
      return authString.split("/")[2];
    } else if (authString.startsWith("STEAM_")) {
      return this.convertToSteam64(authString);
    } else if (authString.startsWith("1:0:") || authString.startsWith("1:1:")) {
      return this.convertToSteam64("STEAM_" + authString);
    } else if (authString.startsWith("[U:1:")) {
      return this.convertToSteam64(authString);
    } else if (authString.startsWith("U:1:")) {
      return this.convertToSteam64("[" + authString + "]");
    } else if (authString.startsWith("7656119")) {
      return authString;
    } else {
      let steamID = await SteamAPI.resolve(
        "steamcommunity.com/id/" + authString
      );
      return steamID;
    }
  }
  /** Retrieves a profile name from steam.
   * @function
   * @memberof module:utils
   * @inner
   * @name getSteamName
   * @param {String} auth64 - String value of a steam 64 ID.
   * @returns A username from a given Steam64 ID.
   */
  static async getSteamName(auth64) {
    try {
      let summaryInfo = await SteamAPI.getUserSummary(auth64);
      return summaryInfo.nickname;
    } catch {
      return null;
    }
  }

  /** Retrieves a profile image from steam.
   * @function
   * @memberof module:utils
   * @inner
   * @name getSteamImage
   * @param {String} auth64 - String value of a steam 64 ID.
   * @returns A profile image link.
   */
  static async getSteamImage(auth64) {
    try {
      let summaryInfo = await SteamAPI.getUserSummary(auth64);
      return summaryInfo.avatar.medium;
    } catch {
      return null;
    }
  }

  /** Checks whether or not a user has access to edit a match. Also checks if a match is currently being played.
   * @function
   * @memberof module:utils
   * @inner
   * @name getUserMatchAccess
   * @param {String} matchid - The ID of a match
   * @param {user} user - the users session object.
   * @param {boolean} [onlyAdmin = false] - Set to true to only check admin status and not super admin status.
   * @param {boolean} [serverCheck = false] - Optional parameter to check if a user owns a server, for elevated calls.
   * @returns An object containing the HTTP error, followed by a message.
   */
  static async getUserMatchAccess(matchid, user, onlyAdmin = false, serverCheck = false) {
    try {
      let retMessage = null;

      retMessage = await this.getUserMatchAccessNoFinalize(matchid, user, onlyAdmin, serverCheck);
      if (retMessage != null)
        return retMessage;


      let currentMatchInfo = "SELECT cancelled, forfeit, end_time FROM `match` WHERE id = ?";
      const matchRow = await db.query(currentMatchInfo, matchid);
      if (
        matchRow[0].cancelled == 1 ||
        matchRow[0].forfeit == 1 ||
        matchRow[0].end_time != null
      ) {
        retMessage = { status: 422, message: "Match is already finished." };
      }
      return retMessage;
    } catch (err) {
      throw err;
    }
  }

  /** Checks whether or not a match exists, ignoring finalized matches.
   * @function
   * @memberof module:utils
   * @inner
   * @name getUserMatchAccessNoFinalize
   * @param {String} matchid - The ID of a match
   * @param {user} user - the users session object.
   * @param {boolean} [onlyAdmin = false] - Set to true to only check admin status and not super admin status.
   * @param {boolean} [serverCheck = false] - Optional parameter to check if a user owns a server, for elevated calls.
   * @returns An object containing the HTTP error, followed by a message.
   */
  static async getUserMatchAccessNoFinalize(matchid, user, onlyAdmin = false, serverCheck = false) {
    try {
      let adminCheck = onlyAdmin ? this.adminCheck(user) : this.superAdminCheck(user);
      let retMessage = null;
      retMessage = await this.checkIfMatchExists(matchid);

      if (retMessage != null)
        return retMessage;


      let currentMatchInfo = "SELECT user_id, server_id FROM `match` WHERE id = ?";
      let currentServerInfo = "SELECT user_id FROM game_server WHERE id = ?"
      const matchRow = await db.query(currentMatchInfo, matchid);

      // If no server exists no need to check for info.
      if (!matchRow[0].server_id) return retMessage;

      const serverRow = await db.query(currentServerInfo, matchRow[0].server_id);
      if (
        matchRow[0].user_id != user.id &&
        !adminCheck
      ) {
        retMessage = { status: 403, message: "User is not authorized to perform action." };
      }
      if (serverCheck) {
        if (
          !this.superAdminCheck(user) &&
          serverRow[0].user_id != user.id
        ) {
          retMessage = { status: 403, message: "User is not authorized to perform action." };
        }
      }
      return retMessage;
    } catch (err) {
      throw err;
    }
  }

  /** Checks whether or not a match exists.
   * @function
   * @memberof module:utils
   * @inner
   * @name checkIfMatchExists
   * @param {String} matchid - The ID of a match
   * @returns An object containing the HTTP error, followed by a message.
   */
  static async checkIfMatchExists(matchid) {
    try {
      if (matchid == null) {
        return { status: 400, message: "Match ID Not Provided" };
      }

      let currentMatchInfo = "SELECT id FROM `match` WHERE id = ?";
      const matchRow = await db.query(currentMatchInfo, matchid);
      if (!matchRow.length) {
        return { status: 404, message: "No match found." };
      }
    } catch (err) {
      throw err;
    }
    return null;
  }

  /** Updates the tables accordingly if match was a PUG.
   * @function
   * @memberof module:utils
   * @inner
   * @name updatePugStats
   * @param {Number} matchid The ID of a match.
   * @param {Number} map_id The ID of a map in a match.
   * @param {Number} team1_id The internal ID of team 1.
   * @param {Number} team2_id The internal ID of team 2.
   * @param {Number} winner The internal ID of the winning team.
   */
  static async updatePugStats(match_id, map_id, team1_id, team2_id, winner, deleteTeams = true) {
    let teamAuthSql =
      "SELECT GROUP_CONCAT(ta.auth) as auth_name, GROUP_CONCAT(CONCAT(ta.name)) as name FROM team_auth_names ta WHERE team_id = ?";
    let pugTeamNameSql = "SELECT name FROM team WHERE id = ?";
    let playerStatUpdateSql = "UPDATE player_stats SET team_name = ?, winner = ? WHERE match_id = ? AND map_id = ? AND steam_id IN (?)";
    let pugSql =
      "DELETE FROM team_auth_names WHERE team_id = ? OR team_id = ?";
    let playerStatCheckExistsSql = "SELECT COUNT(*) as cnt FROM player_stats WHERE match_id = ? AND map_id = ?";
    const teamNameOne = await db.query(pugTeamNameSql, [team1_id]);
    const teamOneAuths = await db.query(teamAuthSql, [team1_id]);
    const teamNameTwo = await db.query(pugTeamNameSql, [team2_id]);
    const teamTwoAuths = await db.query(teamAuthSql, [team2_id]);
    const doPlayerStatsExist = await db.query(playerStatCheckExistsSql, [match_id, map_id]);
    const teamAuthListOne = teamOneAuths[0].auth_name.split(",");
    const teamAuthTwoList = teamTwoAuths[0].auth_name.split(",");
    // Check to see if player stats already exist.
    if (doPlayerStatsExist[0].cnt && doPlayerStatsExist[0].cnt > 0) {
      await db.query(playerStatUpdateSql, [
        teamNameOne[0].name,
        winner == team1_id ? 1 : 0,
        match_id,
        map_id,
        teamAuthListOne
      ]);
      await db.query(playerStatUpdateSql, [
        teamNameTwo[0].name,
        winner == team2_id ? 1 : 0,
        match_id,
        map_id,
        teamAuthTwoList
      ]);
    } else {
      let newPlayerArr = [];
      let teamNameOneList = teamOneAuths[0].name.split(",");
      let teamNameTwoList = teamTwoAuths[0].name.split(",");
      playerStatUpdateSql = "INSERT INTO player_stats (match_id, map_id, team_name, steam_id, name, winner) VALUES ?";
      for (let [idx, auth] of teamAuthListOne.entries()) {
        newPlayerArr.push([
          match_id,
          map_id,
          teamNameOne[0].name,
          auth,
          teamNameOneList[idx],
          winner == team1_id ? 1 : 0
        ]);
      }
      for (let [idx, auth] of teamAuthTwoList.entries()) {
        newPlayerArr.push([
          match_id,
          map_id,
          teamNameTwo[0].name,
          auth,
          teamNameTwoList[idx],
          winner == team2_id ? 1 : 0
        ]);
      }
      await db.query(playerStatUpdateSql, [newPlayerArr]);
    }
    if (deleteTeams) {
      await db.query(pugSql, [
        team1_id,
        team2_id,
      ]);
      pugSql = "DELETE FROM team WHERE id = ? OR id = ?";
      await db.query(pugSql, [
        team1_id,
        team2_id,
      ]);
    }

    return;
  }
}


export default Utils;
