import Utils from "./utils.js";
import Rcon from "rcon";
import fetch from "node-fetch";

/**
 * Creates a new server object to run various tasks.
 * @class
 */
class ServerRcon {
  /**
   * Represents a game server.
   * @constructor
   * @param {string} hostName - IP String or host of server.
   * @param {number} portNumber - Integer port number of the server.
   * @param {string} rconPassword - Rcon password of the server, encrypted.
   */
  constructor(hostName, portNumber, rconPassword) {
    this.host = hostName;
    this.port = portNumber;
    this.password = Utils.decrypt(rconPassword);
  }

  async execute(commandString) {
    return new Promise(async (resolve, reject) => {
      let resp;
      let conn = new Rcon(this.host, this.port, this.password);
      conn
        .on("auth", function () {
          conn.send(commandString);
          conn.disconnect();
        })
        .on("response", function (str) {
          resp = str;
        })
        .on("error", function (error) {
          console.log("[RCON] Got error: " + error);
          return reject(error);
        })
        .on("end", function () {
          resolve(resp);
        });
      conn.connect();
    });
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isGet5Available() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let get5Status = await this.execute("get5_web_available");
      // Weird L coming in from the console call? Incomplete packets.
      get5Status =
        get5Status.substring(0, get5Status.lastIndexOf("L")).length == 0
          ? get5Status
          : get5Status.substring(0, get5Status.lastIndexOf("L"));
      let get5JsonStatus = await JSON.parse(get5Status);
      if (get5Status.includes("Unknown command")) {
        console.log("Either get5 or get5_apistats plugin missing.");
        return false;
      } else if (get5JsonStatus.gamestate != 0) {
        console.log("Server already has a get5 match setup.");
        return false;
      } else {
        return true;
      }
    } catch (err) {
      console.error("Error on isAvailable server: " + err.toString());
      throw err;
    }
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isServerAlive() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let get5Status = await this.execute("status");
      return get5Status != "";
    } catch (err) {
      console.error("Error on game server: " + err.toString());
      return false;
    }
  }

  /**
   * 
   * Checks if the server is up to date via a steam API call.
   * @returns True if up to date, false otherwise.
   */
  async isServerUpToDate() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      // Get server version.
      let serverResponse = await this.execute("version");
      let serverVersion = serverResponse.match(/(?<=version ).*(?= \[)/);
      // Call steam API to check if the version is the latest.
      let response = await fetch("https://api.steampowered.com/ISteamApps/UpToDateCheck/v0001/?appid=730&version=" + serverVersion + "&format=json");
      let data = await response.json();
      if (!data.response.up_to_date) {
        console.log("Server is not up to date! Current version: " + serverVersion + " - Latest version: " + data.response.required_version);
        return false;
      }
      else {
        return true
      }
    } catch (err) {
      console.error("Error on game server: " + err.toString());
      return false;
    }
  }

  /**
   * Sends out an rcon command that is passed in. Returns results to be
   * parsed.
   * @function
   * @param rconCommandString - The rcon command being passed to the server.
   * @returns response from the server.
   */
  async sendRconCommand(rconCommandString) {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let returnValue = await this.execute(rconCommandString);
      return returnValue;
    } catch (err) {
      console.error("Error on sendRCON to server: " + err.toString());
      throw err;
    }
  }

  /**
   * Sets the given URL and API key for a match
   * @function
   * @param get5URLString - The string of the host where the Get5 API is stored.
   * @param get5APIKeyString - The string API key for the game server to authenticate.
   * @returns True if we set everything, false on failure, throw error if there is a problem.
   */
  async prepareGet5Match(get5URLString, get5APIKeyString) {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse = await this.execute(
        "get5_loadmatch_url " + '"' + get5URLString + '"'
      );
      if (loadMatchResponse.includes("Failed")) return false;
      else if (loadMatchResponse.includes("another match already loaded"))
        return false;
      loadMatchResponse = await this.execute(
        "get5_web_api_key " + get5APIKeyString
      );
      // Swap map to default dust2, ensures our cvars stick for the match.
      // await this.execute("map de_dust2");
      return true;
    } catch (err) {
      console.error("Error on preparing match to server: " + err.toString());
      throw err;
    }
  }

  /** Function that will call a match to an end, if it has not been completed normally.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async endGet5Match() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse = await this.execute("get5_endmatch");
      if (loadMatchResponse) return false;
      return true;
    } catch (err) {
      console.error("RCON error on ending match: " + err.toString());
      return false;
    }
  }

  /** Function that will call a pause to the current match. This acts as an admin pause, and will have no time limit.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async pauseMatch() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      await this.execute("sm_pause")
      return true;
    } catch (err) {
      console.error("RCON error on pause: " + err.toString());
      return false;
    }
  }

  /** Function that will call an upause to the current match. This acts as an admin pause, and will have no time limit.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async unpauseMatch() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      await this.execute("sm_unpause");
      return true;
    } catch (err) {
      console.error("RCON error on unpause server: " + err.toString());
      return false;
    }
  }

  /** Adds a user to a given team.
   * @function
   * @param {String} teamString - Either team1 or team2.
   * @param {String} steamId - Formatted Steam64 ID.
   * @param {String} [nickName] - Optional nickname for a given steam ID.
   * @returns Returns the response from the server.
   */
  async addUser(teamString, steamId, nickName = null) {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse;
      if (nickName)
        loadMatchResponse = await this.execute(
          "get5_addplayer " +
            steamId +
            " " +
            teamString +
            " " +
            '"' +
            nickName +
            '"'
        );
      else
        loadMatchResponse = await this.execute(
          "get5_addplayer " + steamId + " " + teamString
        );
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on addUser: " + err.toString());
      throw err;
    }
  }

  /** Adds a coach to a given team.
   * @function
   * @param {String} teamString - Either team1 or team2.
   * @param {String} steamId - Formatted Steam64 ID.
   * @returns Returns the response from the server.
   */
     async addCoach(teamString, steamId) {
      try {
        if (process.env.NODE_ENV === "test") {
          return false;
        }
        let loadMatchResponse;
        loadMatchResponse = await this.execute(
          "get5_addcoach " + steamId + " " + teamString
        );
        return loadMatchResponse;
      } catch (err) {
        console.error("RCON error on addUser: " + err.toString());
        throw err;
      }
    }

  /** Removes a user from the match.
   * @function
   * @param {String} steamId - Formatted Steam64 ID.
   * @returns Returns the response from the server.
   */
  async removeUser(steamId) {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse;
      loadMatchResponse = await this.execute("get5_removeplayer " + steamId);
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on removeUser: " + err.toString());
      throw err;
    }
  }

  /** Retrieves a list of backups on the game server.
   * @function
   * @returns Returns the response from the server.
   */
  async getBackups() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse = await this.execute("get5_listbackups");
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on getBackups: " + err.toString());
      throw err;
    }
  }

  /** Attempts to restore a given backup on the server
   * @function
   * @param {String} backupName - The filename of the backup on the server.
   * @returns Returns the response from the server.
   */
  async restoreBackup(backupName) {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse = await this.execute(
        "get5_loadbackup " + backupName
      );
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on restore backup: " + err.toString());
      throw err;
    }
  }

  /** Attempts to restore a given backup from the API to a new server.
   * @function
   * @param {String} backupName - The filename of the backup on the API.
   * @returns Returns the response from the server.
   */
   async restoreBackupFromURL(backupName) {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse = await this.execute(
        "get5_loadbackup_url \"" + backupName + "\""
      );
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on restore backup: " + err.toString());
      throw err;
    }
  }
}

export default ServerRcon;
