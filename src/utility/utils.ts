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
import SteamAPI from "steamapi";
const steam = new SteamAPI(config.get("server.steamAPIKey"));
/** Steam ID Handler for other IDs.
 * @const
 */
import { ID } from "@node-steam/id";

import {db} from "../services/db.js";
import { RowDataPacket } from 'mysql2';
import { NextFunction, Request, Response } from 'express';
import { Get5_Player } from '../types/Get5_Player.js';
import { User } from "../types/User.js"
import { AccessMessage } from '../types/mapstats/AccessMessage.js';

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
    kills: number = 0,
    roundsplayed: number = 0,
    deaths: number = 0,
    k1: number = 0,
    k2: number = 0,
    k3: number = 0,
    k4: number = 0,
    k5: number = 0
  ) {
    try {
      let AverageKPR: number = 0.679;
      let AverageSPR: number = 0.317;
      let AverageRMK: number = 1.277;
      let KillRating: number =
        roundsplayed === 0 ? 0 : kills / roundsplayed / AverageKPR;
      let SurvivalRating: number =
        roundsplayed === 0
          ? 0
          : (roundsplayed - deaths) / roundsplayed / AverageSPR;
      let killcount: number = k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5;
      let RoundsWithMultipleKillsRating: number =
        roundsplayed === 0 ? 0 : killcount / roundsplayed / AverageRMK;
      let rating: number =
        (KillRating + 0.7 * SurvivalRating + RoundsWithMultipleKillsRating) /
        2.7;

      return +rating.toFixed(2);
    } catch (err) {
      console.error("HELPER getRating Failed -- " + err);
      return 0;
    }
  }

/**
 * Fetches HLTV rating for a user by Steam ID.
 * @param steamId - The user's Steam ID
 * @returns HLTV rating or null if not found
 */
static async getRatingFromSteamId(steamId: string): Promise<number | null> {
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
        WHERE   cancelled = 0)`;
  const user: RowDataPacket[] = await db.query(playerStatSql, [steamId]);;

  if (!user.length) return null;

  return this.getRating(parseFloat(user[0].kills),
    parseFloat(user[0].trp),
    parseFloat(user[0].deaths),
    parseFloat(user[0].k1),
    parseFloat(user[0].k2),
    parseFloat(user[0].k3),
    parseFloat(user[0].k4),
    parseFloat(user[0].k5));
}


  /** Inner function - Supports encryption and decryption for the database keys to get server RCON passwords.
   * @name decrypt
   * @function
   * @inner
   * @memberof module:utils
   * @param {string} source - The source to be decrypted.
   */
  static decrypt(source: string) {
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
  static encrypt(source: string) {
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
  static async ensureAuthenticated(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
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
            api_key: apiKey.split(":")[1]
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
   * @param {user} user - the users session object.
   */
  static adminCheck(user: User) {
    if (user) return user.super_admin === 0 && user.admin === 0 ? false : true;
    else return false;
  }

  /** Checks if a user is a super admin in the system during their session.
   * @function
   * @memberof module:utils
   * @inner
   * @name superAdminCheck
   * @param {user} user - the users session object.
   */
  static superAdminCheck(user: User) {
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
  static async convertToSteam64(anySteamID: string) {
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
  static async getSteamPID(authString: string) {
    // Remove any https tags, as they aren't needed.
    authString = authString.replace(new RegExp("^(http|https)://", "i"), "");
    if (authString.includes("steamcommunity.com/id/")) {
      let steamID = await steam.resolve(authString);
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
      let steamID = await steam.resolve(
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
  static async getSteamName(auth64: string) {
    try {
      let summaryInfo = await steam.getUserSummary(auth64);
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
  static async getSteamImage(auth64: string) {
    try {
      let summaryInfo = await steam.getUserSummary(auth64);
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
   * @param {String|Number} matchid - The ID of a match
   * @param {user} user - the users session object.
   * @param {boolean} [onlyAdmin = false] - Set to true to only check admin status and not super admin status.
   * @param {boolean} [serverCheck = false] - Optional parameter to check if a user owns a server, for elevated calls.
   * @returns An object containing the HTTP error, followed by a message.
   */
  static async getUserMatchAccess(
    matchid: string | number,
    user: User,
    onlyAdmin: boolean = false,
    serverCheck: boolean = false
  ): Promise<AccessMessage | null> {
    try {
      let retMessage: AccessMessage | null;

      retMessage = await this.getUserMatchAccessNoFinalize(
        matchid,
        user,
        onlyAdmin,
        serverCheck
      );
      if (retMessage != null) return retMessage;

      let currentMatchInfo =
        "SELECT cancelled, forfeit, end_time FROM `match` WHERE id = ?";
      const matchRow = await db.query(currentMatchInfo, [matchid]);
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
   * @param {String|Number} matchid - The ID of a match
   * @param {user} user - the users session object.
   * @param {boolean} [onlyAdmin = false] - Set to true to only check admin status and not super admin status.
   * @param {boolean} [serverCheck = false] - Optional parameter to check if a user owns a server, for elevated calls.
   * @returns An object containing the HTTP error, followed by a message.
   */
  static async getUserMatchAccessNoFinalize(
    matchid: string | number,
    user: User,
    onlyAdmin: boolean = false,
    serverCheck: boolean = false
  ): Promise<AccessMessage | null> {
    try {
      let adminCheck: boolean = onlyAdmin
        ? this.adminCheck(user)
        : this.superAdminCheck(user);
      let retMessage: AccessMessage | null = null;
      retMessage = await this.checkIfMatchExists(matchid);

      if (retMessage != null) return retMessage;

      let currentMatchInfo =
        "SELECT user_id, server_id FROM `match` WHERE id = ?";
      let currentServerInfo = "SELECT user_id FROM game_server WHERE id = ?";
      const matchRow = await db.query(currentMatchInfo, [matchid]);

      // If no server exists no need to check for info.
      if (!matchRow[0].server_id) return retMessage;

      const serverRow = await db.query(
        currentServerInfo,
        matchRow[0].server_id
      );
      if (matchRow[0].user_id != user.id && !adminCheck) {
        retMessage = {
          status: 403,
          message: "User is not authorized to perform action."
        };
      }
      if (serverCheck) {
        if (!this.superAdminCheck(user) && serverRow[0].user_id != user.id) {
          retMessage = {
            status: 403,
            message: "User is not authorized to perform action."
          };
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
   * @param {String|Number} matchid - The ID of a match
   * @returns An object containing the HTTP error, followed by a message.
   */
  static async checkIfMatchExists(matchid: string | number): Promise<AccessMessage | null> {
    try {
      if (matchid == null) {
        return { status: 400, message: "Match ID Not Provided" };
      }

      let currentMatchInfo: string = "SELECT id FROM `match` WHERE id = ?";
      const matchRow: RowDataPacket[] = await db.query(currentMatchInfo, [matchid]);
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
   * @param {String|Number} match_id The ID of a match.
   * @param {Number} map_id The ID of a map in a match.
   * @param {Number} team1_id The internal ID of team 1.
   * @param {Number} team2_id The internal ID of team 2.
   * @param {Number} winner The internal ID of the winning team.
   */
  static async updatePugStats(
    match_id: string | number,
    map_id: number,
    team1_id: number,
    team2_id: number,
    winner: number | null,
    deleteTeams = true
  ) {
    let teamAuthSql: string =
      "SELECT GROUP_CONCAT(ta.auth) as auth_name, GROUP_CONCAT(CONCAT(ta.name)) as name FROM team_auth_names ta WHERE team_id = ?";
    let pugTeamNameSql: string = "SELECT name FROM team WHERE id = ?";
    let playerStatUpdateSql: string =
      "UPDATE player_stats SET team_name = ?, winner = ? WHERE match_id = ? AND map_id = ? AND steam_id IN (?)";
    let pugSql: string =
      "DELETE FROM team_auth_names WHERE team_id = ? OR team_id = ?";
    let playerStatCheckExistsSql =
      "SELECT COUNT(*) as cnt FROM player_stats WHERE match_id = ? AND map_id = ?";
    const teamNameOne: RowDataPacket[] = await db.query(pugTeamNameSql, [
      team1_id
    ]);
    const teamOneAuths: RowDataPacket[] = await db.query(teamAuthSql, [
      team1_id
    ]);
    const teamNameTwo: RowDataPacket[] = await db.query(pugTeamNameSql, [
      team2_id
    ]);
    const teamTwoAuths: RowDataPacket[] = await db.query(teamAuthSql, [
      team2_id
    ]);
    const doPlayerStatsExist: RowDataPacket[] = await db.query(
      playerStatCheckExistsSql,
      [match_id, map_id]
    );
    const teamAuthListOne: string[] = teamOneAuths[0].auth_name.split(",");
    const teamAuthTwoList: string[] = teamTwoAuths[0].auth_name.split(",");
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
      let newPlayerArr: Array<{}> = [];
      let teamNameOneList: string[] = teamOneAuths[0].name.split(",");
      let teamNameTwoList: string[] = teamTwoAuths[0].name.split(",");
      playerStatUpdateSql =
        "INSERT INTO player_stats (match_id, map_id, team_name, steam_id, name, winner) VALUES ?";
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
      await db.query(pugSql, [team1_id, team2_id]);
      pugSql = "DELETE FROM team WHERE id = ? OR id = ?";
      await db.query(pugSql, [team1_id, team2_id]);
    }

    return;
  }

  /**
   * Performs a check on the server to see if the provided API key is correct, and if the match has not been finalized.
   * @param {String} providedKey The API key sent by a user/game server.
   * @param {String|Number} matchId The match ID sent by the user/game server.
   * @returns 0 if successful, 1 if provided API key does not match, and 2 if the match has been finalized.
   */
  static async checkApiKey<Number>(
    providedKey: string,
    matchId: string | number
  ) {
    const matchInformation: RowDataPacket[] = await db.query(
      "SELECT api_key, cancelled, end_time FROM `match` WHERE id = ?",
      [matchId]
    );
    if (providedKey.localeCompare(matchInformation[0]?.api_key) !== 0) return 1;
    else if (
      matchInformation[0]?.cancelled === 1 ||
      matchInformation[0]?.end_time != null
    )
      return 2;
    else return 0;
  }

  /**
   * Private helper function to update player stats based on a team.
   * @param {string} matchid The current match ID.
   * @param {string} teamid The team ID of the player being updated.
   * @param {number} mapId The map ID from the database.
   * @param {Get5_Player} player The Get5_Player structure.
   * @param {number} playerId The player ID from the database.
   */
  public static async updatePlayerStats(
    matchid: string,
    teamid: string,
    mapId: number,
    player: Get5_Player,
    playerId: number | null
  ) {
    let insUpdStatement: object;
    let sqlString: string;
    insUpdStatement = {
      match_id: matchid,
      map_id: mapId,
      team_id: teamid,
      steam_id: player.steamid,
      name: player.name,
      kills: player.stats?.kills,
      deaths: player.stats?.deaths,
      roundsplayed: player.stats?.rounds_played,
      assists: player.stats?.assists,
      flashbang_assists: player.stats?.flash_assists,
      teamkills: player.stats?.team_kills,
      knife_kills: player.stats?.knife_kills,
      suicides: player.stats?.suicides,
      headshot_kills: player.stats?.headshot_kills,
      damage: player.stats?.damage,
      util_damage: player.stats?.utility_damage,
      enemies_flashed: player.stats?.enemies_flashed,
      friendlies_flashed: player.stats?.friendlies_flashed,
      bomb_plants: player.stats?.bomb_plants,
      bomb_defuses: player.stats?.bomb_defuses,
      v1: player.stats?.["1v1"],
      v2: player.stats?.["1v2"],
      v3: player.stats?.["1v3"],
      v4: player.stats?.["1v4"],
      v5: player.stats?.["1v5"],
      k1: player.stats?.["1k"],
      k2: player.stats?.["2k"],
      k3: player.stats?.["3k"],
      k4: player.stats?.["4k"],
      k5: player.stats?.["5k"],
      firstdeath_ct: player.stats?.first_deaths_ct,
      firstdeath_t: player.stats?.first_deaths_t,
      firstkill_ct: player.stats?.first_kills_ct,
      firstkill_t: player.stats?.first_kills_t,
      kast: player.stats?.kast,
      contribution_score: player.stats?.score,
      mvp: player.stats?.mvp
    };

    insUpdStatement = await db.buildUpdateStatement(insUpdStatement);

    if (playerId) {
      sqlString = "UPDATE player_stats SET ? WHERE id = ?";
      await db.query(sqlString, [insUpdStatement, playerId]);
    } else {
      sqlString = "INSERT INTO player_stats SET ?";
      await db.query(sqlString, insUpdStatement);
    }
  }

  /**
   * Generates a Counter-Strike-style slug using themed adjectives and nouns,
   * including weapon skins and knife types.
   * Example: "clutch-karambit" or "dusty-dragonlore"
   */
  public static generateSlug(): string {
    const adjectives = [
      'dusty', 'silent', 'brutal', 'clutch', 'smoky', 'tactical', 'deadly', 'stealthy',
      'eco', 'forceful', 'aggressive', 'defensive', 'sneaky', 'explosive', 'fraggy', 'nasty',
      'quick', 'slow', 'noisy', 'clean', 'dirty', 'sharp', 'blind', 'lucky',
      'fiery', 'cold', 'ghostly', 'venomous', 'royal'
    ];

    const nouns = [
      // Weapons & gameplay
      'ak47', 'deagle', 'bombsite', 'flashbang', 'knife', 'smoke', 'molotov', 'awp',
      'nade', 'scout', 'pistol', 'rifle', 'mid', 'long', 'short', 'connector',
      'ramp', 'hegrenade', 'tunnel', 'palace', 'apps', 'boost', 'peek', 'spray',

      // Skins
      'dragonlore', 'fireserpent', 'hyperbeast', 'fade', 'casehardened', 'redline',
      'vulcan', 'asiimov', 'howl', 'bloodsport', 'phantomdisruptor', 'neonrider',

      // Knives
      'karambit', 'bayonet', 'butterfly', 'gutknife', 'falchion', 'shadowdaggers',
      'huntsman', 'talon', 'ursus', 'paracord', 'nomad'
    ];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    return `${adj}-${noun}`;
  }

  public static addChallongeTeamAuthsToArray: (teamId: number, custom_field_response: { key: string; value: string; }) => Promise<void> = async (teamId: number, custom_field_response: { key: string, value: string }) => {
    let teamAuthArray: Array<Array<any>> = [];
    let key: keyof typeof custom_field_response;
    for (key in custom_field_response) {
      let value: string = custom_field_response[key];
      let firstPlayer: boolean = true;
      if (value !== null) {
        let isCaptain: boolean = firstPlayer;
        firstPlayer = false;
        teamAuthArray.push([teamId, value, +isCaptain, '']);
      }
    }
    if (teamAuthArray.length > 0) {
      let sqlString: string = "INSERT INTO team_auth_names (team_id, auth, captain, name) VALUES ?";
      await db.query(sqlString, [teamAuthArray]);
    }
  }

}


export default Utils;
