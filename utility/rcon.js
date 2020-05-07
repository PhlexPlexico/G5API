const util = require( 'util' );

/**
 * Creates a new server object to run various tasks.
 * @class
 */
class Rcon {
    /**
     * Represents a game server.
     * @constructor
     * @param {string} hostName - IP String or host of server.
     * @param {int} portNumber - Integer port number of the server
     * @param {int} [timeOut] - Timeout you wish to have on server
     * @param {string} rconPassword - Rcon password of the server, encrypted.
     */
  constructor(hostName, portNumber, timeOut, rconPassword) {
    this.server = new Rcon({
      host: hostName,
      port: portNumber,
      timeout: timeOut == null ? 10000 : timeOut,
    });
    this.password = util.decrypt(rconPassword);
  }

  async authenticateServer() {
    try{
        await this.server.authenticate(this.password);
        return true;
    } catch(err){
        console.log("Unable to authenticate to server.\nError: " + err.toString());
        return false;
    }
    
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isGet5Available() {
    try {
        await authenticateServer();
        console.log("Authenticated.");
        let get5Status = await this.server.execute('get5_web_avaliable');
        let get5JsonStatus = JSON.parse(get5Status);
        if(get5Status.includes("Unknown command")){
            return "Either get5 or get5_apistats plugin missing.";
        } else if (get5JsonStatus.game_state != 0){
            return "Server already has a get5 match setup."
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
        await authenticateServer();
        console.log("Authenticated.");
        let get5Status = await this.server.execute('status');
        return get5Status == "";
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
  async isServerAlive(rconCommandString) {
    try {
        await authenticateServer();
        console.log("Authenticated.");
        let returnValue = await this.server.execute(rconCommandString);
        return returnValue;
    } catch (err) {
        console.log("Error on game server: " + err.toString());
        throw err;
    }
  }
}

module.exports = Rcon;