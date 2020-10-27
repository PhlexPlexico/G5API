const util = require("./utils");
const Rcon = require("rcon-srcds");

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
   * @param {number} [timeOut] - Timeout you wish to have on server in milliseconds.
   * @param {string} rconPassword - Rcon password of the server, encrypted.
   */
  constructor(hostName, portNumber, timeOut, rconPassword) {
    this.server = new Rcon({
      host: hostName,
      port: portNumber,
      timeout: timeOut == null ? 5000 : timeOut,
    });
    this.password = util.decrypt(rconPassword);
  }

  async authenticateServer() {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      await this.server.authenticate(this.password);
      return true;
    } catch (err) {
      console.error("Unable to authenticate to server. " + err.toString());
      return false;
    }
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
      if (!this.server.authenticated) await this.authenticateServer();
      let get5Status = await this.server.execute("get5_web_avaliable");
      let get5JsonStatus = await JSON.parse(get5Status);
      if (get5Status.includes("Unknown command")) {
        console.log("Either get5 or get5_apistats plugin missing.");
        return false;
      } else if (get5JsonStatus.game_state != 0) {
        console.log("Server already has a get5 match setup.");
        return false;
      } else {
        console.log(get5JsonStatus);
        return true;
      }
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let get5Status = await this.server.execute("status");
      return get5Status != "";
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
      if (!this.server.authenticated) await this.authenticateServer();
      let returnValue = await this.server.execute(rconCommandString);
      return returnValue;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse = await this.server.execute(
        "get5_loadmatch_url " + "\"" + get5URLString + "\""
      );
      if (loadMatchResponse) return false;
      loadMatchResponse = await this.server.execute(
        "get5_web_api_key " + get5APIKeyString
      );
      if (loadMatchResponse) return false;
      // Swap map to default dust2, ensures our cvars stick for the match.
      await this.server.execute("map de_dust2");
      return true;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse = await this.server.execute("get5_endmatch");
      if (loadMatchResponse) return false;
      return true;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse = await this.server.execute("sm_pause");
      if (loadMatchResponse) return false;
      return true;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse = await this.server.execute("sm_unpause");
      if (loadMatchResponse) return false;
      return true;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse;
      if (nickName)
        loadMatchResponse = await this.server.execute(
          "get5_addplayer " + steamId + " " + teamString + " " + nickName
        );
      else
        loadMatchResponse = await this.server.execute(
          "get5_addplayer " + steamId + " " + teamString
        );
      return loadMatchResponse;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse = await this.server.execute("get5_listbackups");
      return loadMatchResponse;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
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
      if (!this.server.authenticated) await this.authenticateServer();
      let loadMatchResponse = await this.server.execute("get5_loadbackup " + backupName);
      return loadMatchResponse;
    } catch (err) {
      console.error("Error on game server: " + err.toString());
      throw err;
    }
  }
}

module.exports = ServerRcon;
