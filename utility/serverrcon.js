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
   * @param {int} portNumber - Integer port number of the server.
   * @param {int} [timeOut] - Timeout you wish to have on server in milliseconds.
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
      if(process.env.NODE_ENV === "test") {
        return false;
      }
      await this.server.authenticate(this.password);
      return true;
    } catch (err) {
      console.log(
        "Unable to authenticate to server.\nError: " + err.toString()
      );
      return false;
    }
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isGet5Available() {
    try {
      if(process.env.NODE_ENV === "test") {
        return false;
      }
      await this.authenticateServer();
      let get5Status = await this.server.execute("get5_web_avaliable");
      let get5JsonStatus = JSON.parse(get5Status);
      if (get5Status.includes("Unknown command")) {
        return "Either get5 or get5_apistats plugin missing.";
      } else if (get5JsonStatus.game_state != 0) {
        return "Server already has a get5 match setup.";
      } else {
        return get5JsonStatus;
      }
    } catch (err) {
      console.log("Error on game server: " + err.toString());
      throw err;
    }
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isServerAlive() {
    try {
      if(process.env.NODE_ENV === "test") {
        return false;
      }
      await this.authenticateServer();
      let get5Status = await this.server.execute("status");
      return get5Status != "";
    } catch (err) {
      console.log("Error on game server: " + err.toString());
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
      if(process.env.NODE_ENV === "test") {
        return false;
      }
      await this.authenticateServer();
      let returnValue = await this.server.execute(rconCommandString);
      return returnValue;
    } catch (err) {
      console.log("Error on game server: " + err.toString());
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
      if(process.env.NODE_ENV === "test") {
        return false;
      }
      await this.authenticateServer();
      let loadMatchResponse = await this.server.execute(
        "get5_loadmatch_url " + get5URLString
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
      console.log("Error on game server: " + err.toString());
      throw err;
    }
  }

  /** Function that will call a match to an end, if it has not been completed normally.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async endGet5Match() {
    try {
      if(process.env.NODE_ENV === "test") {
        return false;
      }
      await this.authenticateServer();
      let loadMatchResponse = await this.server.execute("get5_end_match");
      if (loadMatchResponse) return false;
      return true;
    } catch (err) {
      console.log("Error on game server: " + err.toString());
      return false;
    }
  }
}

module.exports = ServerRcon;
