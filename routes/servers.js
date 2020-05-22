/** Express API router for users in get5.
 * @module routes/servers
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

const db = require("../db");

/** Server Rcon class for Game Server connection.
 * @const
 */
const GameServer = require("../utility/serverrcon");

/** Utility class for various methods used throughout.
 * @const */
const Utils = require("../utility/utils");

/** GET - Route serving to get all game servers. If we are admin, we show more information.
 *  If general public, then we show minimal details and only public servers.
 * @name router.get('/')
 * @function
 * @memberof module:routes/servers
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data.
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin or super admin, adjust by providing rcon password or not.
    let sql = "";
    if (Utils.superAdminCheck(req.user)) {
      sql =
        "SELECT gs.id, gs.in_use, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name FROM game_server gs, user usr WHERE usr.id = gs.user_id";
    } else if (Utils.adminCheck(req.user)) {
      sql =
        "SELECT gs.id, gs.in_use, gs.display_name, gs.ip_string, gs.port, gs.public_server, usr.name FROM game_server gs, user usr WHERE usr.id = gs.user_id";
    } else {
      sql =
        "SELECT gs.id, gs.in_use, gs.display_name, usr.name FROM game_server gs, user usr WHERE gs.public_server=1 AND usr.id = gs.user_id";
    }
    const allServers = await db.query(sql);
    if (Utils.superAdminCheck(req.user)) {
      for (let serverRow of allServers) {
        serverRow.rcon_password = await Utils.decrypt(serverRow.rcon_password);
      }
    }
    res.json(allServers);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get all personal game servers.
 * @name router.get('/myservers')
 * @function
 * @memberof module:routes/servers
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/myservers", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql =
      "SELECT gs.id, gs.in_use, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name FROM game_server gs, user usr WHERE usr.id = gs.user_id AND usr.id=?";
    const allServers = await db.query(sql, req.user.id);
    for (let serverRow of allServers) {
      serverRow.rcon_password = await Utils.decrypt(serverRow.rcon_password);
    }
    res.json(allServers);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get one game server by database id.
 * @name router.get('/:server_id')
 * @memberof module:routes/servers
 * @function
 * @param {string} path - Express path
 * @param {number} request.param.server_id - The ID of the game server.
 * @param {callback} middleware - Express middleware.
 * @param {int} user_id - The user ID that is querying the data. Check if they own it or are an admin.
 */
router.get(
  "/:server_id",
  /*Utils.ensureAuthenticated,*/ async (req, res, next) => {
    try {
      let serverID = req.params.server_id;
      let sql = "";
      let server;
      if (Utils.superAdminCheck(req.user)) {
        sql =
          "SELECT gs.id, gs.in_use, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name FROM game_server gs, user usr WHERE usr.id = gs.user_id AND gs.id = ?";
        server = await db.query(sql, [serverID]);
      } else {
        sql =
          "SELECT gs.id, gs.in_use, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name FROM game_server gs, user usr WHERE usr.id = gs.user_id AND gs.id = ? AND usr.id = ?";
        server = await db.query(sql, [serverID, req.user.id]);
      }
      if (server.length < 1) {
        res
          .status(401)
          .json({ message: "User is not authorized to view server info." });
      } else {
        server[0].rcon_password = await Utils.decrypt(server[0].rcon_password);
        res.json(server);
      }
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
);

/** GET - Gets a status of a game server.
 * @name router.delete('/:server_id/status')
 * @memberof module:routes/servers
 * @function
 * @param {int} req.body[0].server_id - The ID of the server being queried.
 *
 */
router.get(
  "/:server_id/status",
  /*Utils.ensureAuthenticated,*/ async (req, res, next) => {
    let userCheckSql =
      "SELECT user_id, ip_string, port, rcon_password FROM game_server WHERE id=?";
    let userId = req.user.id;
    const serverInfo = await db.query(userCheckSql, [req.body[0].server_id]);
    if (serverInfo[0] == null) {
      res.status(404).json({ message: "Server does not exist." });
      return;
    } else if (
      serverInfo[0].user_id != userId &&
      !Utils.superAdminCheck(req.user)
    ) {
      res
        .status(401)
        .json({ message: "User is not authorized to perform action." });
      return;
    } else {
      try {
        let ourServer = new GameServer(
          serverInfo[0].ip_string,
          serverInfo[0].port,
          2500,
          serverInfo[0].rcon_password
        );
        let serverUp = await ourServer.isServerAlive();
        if (!serverUp) {
          res
            .status(408)
            .json({
              message:
                "Server did not respond in 2500 ms. Please check if server is online and password is correct.",
            });
        } else {
          res.json({ message: "Server is alive and online." });
        }
      } catch (err) {
        res.status(500).json({ message: err.toString() });
      }
    }
  }
);

/** POST - Create a game server in the database, and encrypt the password.
 * @name router.post('/create')
 * @memberof module:routes/servers
 * @function
 * @param {int} req.user.id - The ID of the user creating the server to claim ownership.
 * @param {string} req.body[0].ip_string - The host of the server. Can be a URL or IP Address.
 * @param {int} req.body[0].port - The port that the server is used to connect with.
 * @param {string} req.body[0].display_name - The name that people will see on the game panel.
 * @param {string} req.body[0].rcon_password - The RCON password of the server. This will be encrypted on the server side.
 * @param {int} req.body[0].public_server - Integer value evaluating if the server is public.
 *
 */
router.post("/create", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    await db.withTransaction(async () => {
      let userId = req.user.id;
      let ipString = req.body[0].ip_string;
      let port = req.body[0].port;
      let displayName = req.body[0].display_name;
      let rconPass = await Utils.encrypt(req.body[0].rcon_password);
      let publicServer = req.body[0].public_server;
      let sql =
        "INSERT INTO game_server (user_id, ip_string, port, rcon_password, display_name, public_server) VALUES (?,?,?,?,?,?)";
      await db.query(sql, [
        userId,
        ipString,
        port,
        rconPass,
        displayName,
        publicServer,
      ]);
      let ourServer = new GameServer(
        req.body[0].ip_string,
        req.body[0].port,
        2500,
        rconPass
      );
      let serverUp = await ourServer.isServerAlive();
      if (!serverUp) {
        res.json({
          message:
            "Game Server did not respond in time. However, we have still inserted the server successfully.",
        });
      } else {
        res.json({ message: "Game server inserted successfully!" });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** PUT - Update a game server in the database, and encrypt the password.
 * @name router.put('/update')
 * @memberof module:routes/servers
 * @function
 * @param {int} req.body[0].user_id - The ID of the user if transferring ownership.
 * @param {int} req.body[0].server_id - The ID of the server being updated.
 * @param {string} req.body[0].ip_string - The host of the server. Can be a URL or IP Address.
 * @param {int} req.body[0].port - The port that the server is used to connect with.
 * @param {string} req.body[0].display_name - The name that people will see on the game panel.
 * @param {string} req.body[0].rcon_password - The RCON password of the server. This will be encrypted on the server side.
 * @param {int} req.body[0].public_server - Integer value evaluating if the server is public.
 *
 */
router.put("/update", Utils.ensureAuthenticated, async (req, res, next) => {
  let userCheckSql = "SELECT user_id FROM game_server WHERE id = ?";
  let userId = req.user.id;
  const checkUser = await db.query(userCheckSql, [req.body[0].server_id]);
  if (checkUser[0] == null) {
    res.status(404).json({ message: "Server does not exist." });
    return;
  } else if (
    checkUser[0].user_id != userId &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(401)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction(async () => {
        let serverId = req.body[0].server_id;
        let updateStmt = {
          ip_string: req.body[0].ip_string,
          port: req.body[0].port,
          display_name: req.body[0].display_name,
          rcon_password:
            req.body[0].rcon_password == null
              ? null
              : await Utils.encrypt(req.body[0].rcon_password),
          public_server: req.body[0].public_server,
          user_id: req.body[0].user_id,
        };
        // Remove any unwanted nulls.
        updateStmt = await db.buildUpdateStatement(updateStmt);
        if (Object.keys(updateStmt).length === 0) {
          res
            .status(412)
            .json({ message: "No update data has been provided." });
          return;
        }
        let sql = "UPDATE game_server SET ? WHERE id = ?";
        updatedServer = await db.query(sql, [updateStmt, serverId]);
        if (updatedServer.affectedRows > 0) {
          // Get all server info
          sql = "SELECT ip_string, port, rcon_password FROM game_server WHERE id = ?";
          const serveInfo = await db.query(sql, [serverId]);
          let ourServer = new GameServer(
            req.body[0].ip_string == null ? serveInfo[0].ip_string : req.body[0].ip_string,
            req.body[0].port == null ? serveInfo[0].port : req.body[0].port,
            2500,
            req.body[0].rcon_password == null ? serveInfo[0].rcon_password : Utils.encrypt(req.body[0].rcon_password)
          );
          let serverUp = await ourServer.isServerAlive();
          if (!serverUp) {
            res.json({
              message:
                "Game Server did not respond in time. However, we have still inserted the server successfully.",
            });
          } else {
            res.json({ message: "Game server inserted successfully!" });
          }
        } else
          res.status(500).json({ message: "ERROR - Game server not updated." });
      });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
});

/** DEL - Delete a game server in the database.
 * @name router.delete('/delete')
 * @memberof module:routes/servers
 * @function
 * @param {int} req.body[0].server_id - The ID of the server being updated.
 *
 */
router.delete("/delete", Utils.ensureAuthenticated, async (req, res, next) => {
  let userCheckSql = "SELECT user_id FROM game_server WHERE id = ?";
  const checkUser = await db.query(userCheckSql, [req.body[0].server_id]);
  if (checkUser[0] == null) {
    res.status(404).json({ message: "Server does not exist." });
    return;
  } else if (
    checkUser[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(401)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      await db.withTransaction(async () => {
        let userId = req.user.id;
        let serverId = req.body[0].server_id;
        let sql = "";
        let delRows = null;
        if (Utils.superAdminCheck(req.user)) {
          sql = "DELETE FROM game_server WHERE id = ?";
          delRows = await db.query(sql, [serverId]);
        } else {
          sql = "DELETE FROM game_server WHERE id = ? AND user_id = ?";
          delRows = await db.query(sql, [serverId, userId]);
        }
        if (delRows.affectedRows > 0)
          res.json({ message: "Game server deleted successfully!" });
        else {
          res.status(500).json({ message: "Error! Unable to delete record. " });
        }
      });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
});

module.exports = router;
