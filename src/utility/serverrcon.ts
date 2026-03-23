import config from "config";
import Utils from "./utils.js";
import fetch from "node-fetch";
import { compare } from "compare-versions";
import { createConnection, Socket } from "node:net";
import { SteamApiResponse } from "../types/serverrcon/SteamApiResponse.js";

const RCON_TIMEOUT_MS = config.has("server.serverPingTimeoutMs")
  ? config.get<number>("server.serverPingTimeoutMs")
  : 5000;

/**
 * Creates a new server object to run various tasks.
 * @class
 */
class ServerRcon {
  host: string;
  port: number;
  password: string;
  private static readonly AUTH_PACKET_TYPE = 3;
  private static readonly EXEC_PACKET_TYPE = 2;
  private static readonly COMMAND_RESPONSE_IDLE_MS = 75;

  /**
   * Represents a game server.
   * @constructor
   * @param {string} hostName - IP String or host of server.
   * @param {number} portNumber - Integer port number of the server.
   * @param {string} rconPassword - Rcon password of the server, encrypted.
   */
  constructor(hostName: string, portNumber: number, rconPassword: string) {
    this.host = hostName;
    this.port = portNumber;
    this.password = Utils.decrypt(rconPassword)!;
  }

  async execute(commandString: string): Promise<string> {
    try {
      const response = await this.executeWithSocket(commandString);
      return response;
    } catch (error) {
      console.error("[RCON] Got error: " + error);
      throw error;
    }
  }

  private buildPacket(requestId: number, packetType: number, body: string): Buffer {
    const bodyBuffer = Buffer.from(body, "utf8");
    const size = 4 + 4 + bodyBuffer.length + 2;
    const packet = Buffer.alloc(size + 4);
    packet.writeInt32LE(size, 0);
    packet.writeInt32LE(requestId, 4);
    packet.writeInt32LE(packetType, 8);
    bodyBuffer.copy(packet, 12);
    packet.writeInt16LE(0, 12 + bodyBuffer.length);
    return packet;
  }

  private executeWithSocket(commandString: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket: Socket = createConnection({
        host: this.host,
        port: this.port,
      });

      const authRequestId = Math.floor(Math.random() * 2147483647);
      const commandRequestId = Math.floor(Math.random() * 2147483647);
      let commandSent = false;
      let authSucceeded = false;
      let settled = false;
      let receivedCommandResponse = false;
      let readBuffer = Buffer.alloc(0);
      const responseParts: string[] = [];

      let responseIdleTimer: NodeJS.Timeout | null = null;
      const hardTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(new Error(`RCON timeout after ${RCON_TIMEOUT_MS}ms`));
      }, RCON_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(hardTimeout);
        if (responseIdleTimer) {
          clearTimeout(responseIdleTimer);
          responseIdleTimer = null;
        }
      };

      const finalizeSuccess = () => {
        if (settled) return;
        settled = true;
        cleanup();
        socket.end();
        resolve(responseParts.join("").trimEnd());
      };

      const finalizeError = (err: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        socket.destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      const bumpResponseIdleWindow = () => {
        if (responseIdleTimer) {
          clearTimeout(responseIdleTimer);
        }
        responseIdleTimer = setTimeout(
          finalizeSuccess,
          ServerRcon.COMMAND_RESPONSE_IDLE_MS
        );
      };

      socket.on("connect", () => {
        socket.write(
          this.buildPacket(
            authRequestId,
            ServerRcon.AUTH_PACKET_TYPE,
            this.password
          )
        );
      });

      socket.on("data", (chunk: Buffer) => {
        readBuffer = Buffer.concat([readBuffer, chunk]);

        while (readBuffer.length >= 4) {
          const packetSize = readBuffer.readInt32LE(0);
          const fullPacketSize = packetSize + 4;

          if (packetSize < 10) {
            finalizeError(new Error("Received malformed RCON packet."));
            return;
          }

          if (readBuffer.length < fullPacketSize) {
            return;
          }

          const packet = readBuffer.subarray(0, fullPacketSize);
          readBuffer = readBuffer.subarray(fullPacketSize);

          const responseId = packet.readInt32LE(4);
          const bodyLength = packetSize - 10;
          const body = packet.toString("utf8", 12, 12 + bodyLength);

          if (!authSucceeded) {
            if (responseId === -1) {
              finalizeError(new Error("RCON authentication error."));
              return;
            }
            if (responseId === authRequestId && !commandSent) {
              authSucceeded = true;
              commandSent = true;
              socket.write(
                this.buildPacket(
                  commandRequestId,
                  ServerRcon.EXEC_PACKET_TYPE,
                  commandString
                )
              );
            }
            continue;
          }

          if (responseId === commandRequestId) {
            receivedCommandResponse = true;
            if (body.length > 0) {
              responseParts.push(body);
            }
            bumpResponseIdleWindow();
          }
        }
      });

      socket.on("error", (err) => {
        finalizeError(err);
      });

      socket.on("close", () => {
        if (settled) return;
        if (receivedCommandResponse) {
          finalizeSuccess();
          return;
        }
        finalizeError(
          new Error("RCON socket closed before receiving command response.")
        );
      });
    });
  }

  private extractFirstJsonObject(rawResponse: string): string {
    const trimmed = rawResponse.trim();
    if (!trimmed) {
      throw new Error("Received empty RCON response while JSON was expected.");
    }

    const firstBraceIdx = trimmed.indexOf("{");
    if (firstBraceIdx === -1) {
      throw new Error(`No JSON object found in RCON response: ${trimmed}`);
    }

    let depth = 0;
    let inString = false;
    let isEscaping = false;
    let endBraceIdx = -1;

    for (let i = firstBraceIdx; i < trimmed.length; i++) {
      const ch = trimmed[i];

      if (inString) {
        if (isEscaping) {
          isEscaping = false;
          continue;
        }
        if (ch === "\\") {
          isEscaping = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }

      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          endBraceIdx = i;
          break;
        }
      }
    }

    if (endBraceIdx === -1) {
      throw new Error(`Incomplete JSON object in RCON response: ${trimmed}`);
    }

    return trimmed.slice(firstBraceIdx, endBraceIdx + 1);
  }

  private parseRconJsonResponse<T = any>(rawResponse: string): T {
    const normalized = rawResponse.trim();
    try {
      return JSON.parse(normalized) as T;
    } catch (_) {
      const extracted = this.extractFirstJsonObject(normalized);
      return JSON.parse(extracted) as T;
    }
  }

  /**
   * Retrieve Get5's version from the server.
   * @returns The version of the plugin if found, unknown otherwise.
   */
  async getGet5Version(): Promise<string> {
    if (process.env.NODE_ENV === "test") {
      return "unknown";
    }
    let get5Status = await this.execute("get5_status");
    if (get5Status.includes("Unknown command")) {
      return "unknown";
    }
    let get5JsonStatus = this.parseRconJsonResponse<{ plugin_version: string }>(get5Status);
    return get5JsonStatus.plugin_version;
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isGet5Available(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let get5Status = await this.execute("get5_web_available");
      if (get5Status.includes("Unknown command")) {
        let get5Version = await this.getGet5Version();
        if (compare(get5Version, "0.13.1", ">=")) {
          return true;
        } else {
          console.log("Either get5, MatchZy, or PugSharp plugin is missing.");
          return false;
        }
      }
      let get5JsonStatus = this.parseRconJsonResponse<{ gamestate: number | string }>(get5Status);
      if (get5JsonStatus.gamestate != 0) {
        console.log("Server already has a match setup.");
        return false;
      } else {
        return true;
      }
    } catch (err) {
      console.error("Error on isAvailable server: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Checks the availability of the game server via a get5 call.
   * @function
   */
  async isServerAlive(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let get5Status = await this.execute("net_public_adr");
      return get5Status != "";
    } catch (err) {
      console.error("Error on game server: " + (err as Error).toString());
      return false;
    }
  }

  /**
   * Checks if the server is up to date via a steam API call.
   * @returns True if up to date, false otherwise.
   */
  async isServerUpToDate(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let serverResponse: string = await this.execute("status");
      let serverVersion: string | undefined = serverResponse.match(/(?<=\/)\d+/)?.toString();

      if (!serverVersion) {
        throw new Error("Failed to extract server version from response.");
      }

      let response = await fetch(
        `https://api.steampowered.com/ISteamApps/UpToDateCheck/v0001/?appid=730&version=${serverVersion}&format=json`
      );

      
      let data: SteamApiResponse = await response.json() as SteamApiResponse;
      if (!data.response.up_to_date) {
        console.log(
          `Server is not up to date! Current version: ${serverVersion} - Latest version: ${data.response.required_version}`
        );
        return false;
      } else {
        return true;
      }
    } catch (err) {
      console.error("Error on game server: " + (err as Error).toString());
      return false;
    }
  }

  /**
   * Sends out an rcon command that is passed in. Returns results to be parsed.
   * @function
   * @param rconCommandString - The rcon command being passed to the server.
   * @returns response from the server.
   */
  async sendRconCommand(rconCommandString: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot send rcon commands in a test instance, please use development or production instead.";
      }
      let returnValue = await this.execute(rconCommandString);
      return returnValue;
    } catch (err) {
      console.error("Error on sendRCON to server: " + (err as Error).toString());
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
  async prepareGet5Match(
    get5URLString: string,
    get5APIKeyString: string
  ): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse: string;
      let get5Version = await this.getGet5Version();
      if (compare(get5Version, "0.13.1", ">=")) {
        loadMatchResponse = await this.execute(
          `get5_loadmatch_url "${get5URLString}" "Authorization" "${get5APIKeyString}"`
        );
      } else {
        loadMatchResponse = await this.execute(
          `get5_loadmatch_url "${get5URLString}"`
        );
      }

      if (loadMatchResponse.includes("Failed")) return false;
      else if (loadMatchResponse.includes("another match already loaded"))
        return false;

      if (compare(get5Version, "0.13.1", "<")) {
        await this.execute(`get5_web_api_key ${get5APIKeyString}`);
      }
      return true;
    } catch (err) {
      console.error("Error on preparing match to server: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Function that will call a match to an end, if it has not been completed normally.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async endGet5Match(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      let loadMatchResponse = await this.execute("get5_endmatch");
      if (loadMatchResponse) return false;
      return true;
    } catch (err) {
      console.error("RCON error on ending match: " + (err as Error).toString());
      return false;
    }
  }

  /**
   * Function that will call a pause to the current match. This acts as an admin pause, and will have no time limit.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async pauseMatch(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      await this.execute("sm_pause");
      return true;
    } catch (err) {
      console.error("RCON error on pause: " + (err as Error).toString());
      return false;
    }
  }

  /**
   * Function that will call an unpause to the current match. This acts as an admin pause, and will have no time limit.
   * @function
   * @returns True if we succeed, false otherwise.
   */
  async unpauseMatch(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === "test") {
        return false;
      }
      await this.execute("sm_unpause");
      return true;
    } catch (err) {
      console.error("RCON error on unpause server: " + (err as Error).toString());
      return false;
    }
  }

  /**
   * Adds a user to a given team.
   * @function
   * @param {String} teamString - Either team1 or team2.
   * @param {String} steamId - Formatted Steam64 ID.
   * @param {String} [nickName] - Optional nickname for a given steam ID.
   * @returns Returns the response from the server.
   */
  async addUser(teamString: string, steamId: string, nickName: string | null = null): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot add user on a test instance. Please use a development or production environment.";
      }
      let loadMatchResponse: string;
      if (nickName)
        loadMatchResponse = await this.execute(
          `get5_addplayer ${steamId} ${teamString} "${nickName}"`
        );
      else
        loadMatchResponse = await this.execute(
          `get5_addplayer ${steamId} ${teamString}`
        );
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on addUser: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Adds a coach to a given team.
   * @function
   * @param {String} teamString - Either team1 or team2.
   * @param {String} steamId - Formatted Steam64 ID.
   * @returns Returns the response from the server.
   */
  async addCoach(teamString: string, steamId: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot add coaches on a test instance. Please use a development or production environment.";
      }
      let loadMatchResponse = await this.execute(
        `get5_addcoach ${steamId} ${teamString}`
      );
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on addCoach: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Removes a user from the match.
   * @function
   * @param {String} steamId - Formatted Steam64 ID.
   * @returns Returns the response from the server.
   */
  async removeUser(steamId: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot remove users on a test instance. Please use a development or production environment.";
      }
      let loadMatchResponse = await this.execute(`get5_removeplayer ${steamId}`);
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on removeUser: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Retrieves a list of backups on the game server.
   * @function
   * @returns Returns the response from the server.
   */
  async getBackups(): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot get backups on a test instance. Please use a development or production environment.";
      }
      let loadMatchResponse = await this.execute("get5_listbackups");
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on getBackups: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Attempts to restore a given backup on the server
   * @function
   * @param {String} backupName - The filename of the backup on the server.
   * @returns Returns the response from the server.
   */
  async restoreBackup(backupName: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot restore backups on a test instance. Please use a development or production environment.";
      }
      let loadMatchResponse = await this.execute(`get5_loadbackup ${backupName}`);
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on restore backup: " + (err as Error).toString());
      throw err;
    }
  }

  /**
   * Attempts to restore a given backup from the API to a new server.
   * @function
   * @param {String} backupName - The filename of the backup on the API.
   * @returns Returns the response from the server.
   */
  async restoreBackupFromURL(backupName: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === "test") {
        return "Cannot restore backups on a test instance. Please use a development or production environment.";
      }
      let loadMatchResponse = await this.execute(`get5_loadbackup_url "${backupName}"`);
      return loadMatchResponse;
    } catch (err) {
      console.error("RCON error on restore backup: " + (err as Error).toString());
      throw err;
    }
  }
}

export default ServerRcon;
