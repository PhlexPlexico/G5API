/** Utilities class for help with basic functions.
 * @module utils
 */

/** AES Module for Encryption/Decryption
 * @const
 */
const aes = require("aes-js");

/** Crypto for assigning random  */
const crypto = require("crypto");

/** Config to get database key.
 * @const
 */
const config = require("config");

/** Steam API Handler for custom URLs
 * @const
 */
const SteamURLResolver = require("steamapi");
const SteamAPI = new SteamURLResolver(config.get("server.steamAPIKey"));
/** Steam ID Handler for other IDs.
 * @const
 */
const SteamIDResolver = require("@node-steam/id");

const db = require("../db");

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
      let byteSource = aes.utils.hex.toBytes(source.substring(32));
      let IV = aes.utils.hex.toBytes(source.substring(0, 32));
      let key = aes.utils.utf8.toBytes(config.get("server.dbKey"));
      let aesCbc = new aes.ModeOfOperation.ofb(key, IV);
      let decryptedBytes = aesCbc.decrypt(byteSource);
      let decryptedText = aes.utils.utf8.fromBytes(decryptedBytes);
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

      let byteSource = aes.utils.utf8.toBytes(source);
      let IV = crypto.randomBytes(16);
      let key = aes.utils.utf8.toBytes(config.get("server.dbKey"));
      let aesCbc = new aes.ModeOfOperation.ofb(key, IV);
      let encryptedBytes = aesCbc.encrypt(byteSource);
      let encryptedHex = aes.utils.hex.fromBytes(encryptedBytes);
      let hexIV = aes.utils.hex.fromBytes(IV);
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
    if (
      req.body[0] != null &&
      req.body[0].user_api != null &&
      req.body[0].user_id
    ) {
      // Check the user based on API.
      let apiKey = req.body[0].user_api;
      let userId = req.body[0].user_id;
      let sqlQuery = "SELECT * FROM user WHERE id = ?";
      const ourUser = await db.query(sqlQuery, userId);
      if (ourUser.length > 0) {
        let uncDb = await Utils.decrypt(ourUser[0].api_key);
        if (uncDb == apiKey) {
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
    //console.log(anySteamID);
    const steam64ID = new SteamIDResolver.ID(anySteamID);
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
    let summaryInfo = await SteamAPI.getUserSummary(auth64);
    return summaryInfo.nickname;
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
    let summaryInfo = await SteamAPI.getUserSummary(auth64);
    return summaryInfo.avatar.medium;
  }

  /** Checks whether or not a user has access to edit a match. Also checks if a match is currently being played.
   * @function
   * @memberof module:utils
   * @inner
   * @name getUserMatchAccess
   * @param {String} matchid - The ID of a match
   * @param {user} user - the users session object.
   * @param {boolean} [onlyAdmin = false] - Set to true to only check admin status and not super admin status.
   * @returns An object containing the HTTP error, followed by a message.
   */
   static async getUserMatchAccess(matchid, user, onlyAdmin = false) {
    try {
      let retMessage = null;

      retMessage = await this.getUserMatchAccessNoFinalize(matchid, user, onlyAdmin);
      if(retMessage != null)
        return retMessage;

      let newSingle = await db.getConnection();

      await db.withNewTransaction(newSingle, async () => {
        let currentMatchInfo = "SELECT cancelled, forfeit, end_time FROM `match` WHERE id = ?";
        const matchRow = await newSingle.query(currentMatchInfo, matchid);
        if (
          matchRow[0][0].cancelled == 1 ||
          matchRow[0][0].forfeit == 1 ||
          matchRow[0][0].end_time != null
        ) {
          retMessage = {status: 422, message: "Match is already finished."};
        }
      });
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
   * @returns An object containing the HTTP error, followed by a message.
   */
   static async getUserMatchAccessNoFinalize(matchid, user, onlyAdmin = false) {
    try {
      let adminCheck = onlyAdmin ? this.adminCheck(user) : this.superAdminCheck(user);
      let retMessage = null;
      retMessage = await this.checkIfMatchExists(matchid);

      if(retMessage != null)
        return retMessage;

      let newSingle = await db.getConnection();

      await db.withNewTransaction(newSingle, async () => {
        let currentMatchInfo = "SELECT user_id FROM `match` WHERE id = ?";
        const matchRow = await newSingle.query(currentMatchInfo, matchid);
        if (
          matchRow[0][0].user_id != user.id &&
          !adminCheck
        ) {
          retMessage = {status: 403, message: "User is not authorized to perform action."};
        }
      });
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
        return {status: 400, message: "Match ID Not Provided"};
      }
      let newSingle = await db.getConnection();
      
      await db.withNewTransaction(newSingle, async () => {
        let currentMatchInfo = "SELECT id FROM `match` WHERE id = ?";
        const matchRow = await newSingle.query(currentMatchInfo, matchid);
        if (matchRow[0].length === 0) {
          return {status: 404, message: "No match found."};
        }
      });
    } catch (err) {
      throw err;
    }
    return null;
  }

}

module.exports = Utils;
