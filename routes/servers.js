 /**
 * @swagger
 * resourcePath: /servers
 * description: Express API router for servers in get5.
 */

const express = require("express");


const router = express.Router();

const db = require("../db");

const GameServer = require("../utility/serverrcon");

const Utils = require("../utility/utils");


/**
 * @swagger
 *
 * components:
 *   schemas:
 *    ServerData:
 *      type: object
 *      required:
 *        - server_id
 *        - ip_string
 *        - port
 *        - rcon_password
 *      properties:
 *        server_id:
 *          type: integer
 *          description: Unique Server ID.
 *        ip_string:
 *          type: string
 *          description: The IP or host name of the server.
 *        port:
 *          type: integer
 *          description: Port of the server.
 *        display_name:
 *          type: string
 *          description: Visible name of the server.
 *        rcon_password:
 *          type: string
 *          description: RCON password of the server.
 *        public_server:
 *          type: boolean
 *          description: Whether a server can be publically used.
 *   responses:
 *     NoServerData:
 *       description: No server data was provided.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /servers/:
 *   get:
 *     description: Get all servers from the application. RCON passwords, too, if an admin.
 *     produces:
 *       - application/json
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: All visible server information
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  servers:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/ServerData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    // Check if admin or super admin, adjust by providing rcon password or not.
    let sql = "";
    if (Utils.superAdminCheck(req.user)) {
      sql =
        "SELECT gs.id, gs.in_use, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name, usr.id as user_id FROM game_server gs, user usr WHERE usr.id = gs.user_id";
    } else if (Utils.adminCheck(req.user)) {
      sql =
        "SELECT gs.id, gs.in_use, gs.display_name, gs.ip_string, gs.port, gs.public_server, usr.name, usr.id as user_id FROM game_server gs, user usr WHERE usr.id = gs.user_id";
    } else {
      sql =
        "SELECT gs.id, gs.in_use, gs.display_name, usr.name, gs.public_server FROM game_server gs, user usr WHERE gs.public_server=1 AND usr.id = gs.user_id";
    }
    const servers = await db.query(sql);
    if (Utils.superAdminCheck(req.user)) {
      for (let serverRow of servers) {
        serverRow.rcon_password = await Utils.decrypt(serverRow.rcon_password);
      }
    }
    res.json({servers});
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /servers/available:
 *   get:
 *     description: Get all available servers depending on access level.
 *     produces:
 *       - application/json
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: All visible server information
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  servers:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/ServerData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/available", async (req, res, next) => {
  try {
    // Check if admin or super admin, adjust by providing rcon password or not.
    let sql = "";
    if (Utils.superAdminCheck(req.user)) {
      sql =
        "SELECT gs.id, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name, usr.id as user_id FROM game_server gs, user usr WHERE usr.id = gs.user_id AND gs.in_use=0";
    } else if (Utils.adminCheck(req.user)) {
      sql =
        "SELECT gs.id, gs.display_name, gs.ip_string, gs.port, gs.public_server, usr.name, usr.id as user_id FROM game_server gs, user usr WHERE usr.id = gs.user_id AND gs.in_use=0";
    } else {
      sql =
        "SELECT gs.id, gs.display_name, usr.name FROM game_server gs, user usr WHERE gs.public_server=1 AND usr.id = gs.user_id AND gs.in_use=0";
    }
    const servers = await db.query(sql);
    if (Utils.superAdminCheck(req.user)) {
      for (let serverRow of servers) {
        serverRow.rcon_password = await Utils.decrypt(serverRow.rcon_password);
      }
    }
    res.json({servers});
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /servers/myservers:
 *   get:
 *     description: Set of servers from the logged in user.
 *     produces:
 *       - application/json
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: Server information
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  servers:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/ServerData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/myservers", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    // Check if admin, if they are use this query.
    let sql =
      "SELECT gs.id, gs.in_use, gs.ip_string, gs.port, gs.rcon_password, gs.display_name, gs.public_server, usr.name, usr.id as user_id FROM game_server gs, user usr WHERE usr.id = gs.user_id AND usr.id=?";
    const servers = await db.query(sql, req.user.id);
    for (let serverRow of servers) {
      serverRow.rcon_password = await Utils.decrypt(serverRow.rcon_password);
    }
    res.json({servers});
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /servers/:server_id:
 *   get:
 *     description: Returns a provided server info.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: server_id
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: Specific server information
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  server:
 *                    $ref: '#/components/schemas/ServerData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get(
  "/:server_id",
  Utils.ensureAuthenticated, async (req, res, next) => {
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
          .status(403)
          .json({ message: "User is not authorized to view server info, or server does not exist." });
      } else {
        server[0].rcon_password = await Utils.decrypt(server[0].rcon_password);
        server = JSON.parse(JSON.stringify(server[0]));
        res.json({server});
      }
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
);

/**
 * @swagger
 *
 * /servers/:server_id:/status:
 *   get:
 *     description: Returns a provided server status.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: server_id
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: Server info, if available.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get(
  "/:server_id/status",
  Utils.ensureAuthenticated, async (req, res, next) => {
    let userCheckSql =
      "SELECT user_id, ip_string, port, rcon_password FROM game_server WHERE id=?";
    let userId = req.user.id;
    const serverInfo = await db.query(userCheckSql, [req.params.server_id]);
    if (serverInfo[0] == null) {
      res.status(404).json({ message: "Server does not exist." });
      return;
    } else if (
      serverInfo[0].user_id != userId &&
      !Utils.superAdminCheck(req.user)
    ) {
      res
        .status(403)
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

/**
 * @swagger
 *
 * /servers:
 *   post:
 *     description: Creates a new server to use.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/ServerData'
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: Server created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
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
      let insertServer = await db.query(sql, [
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
        res.json({ message: "Game server inserted successfully!", id: insertServer.insertId });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /servers:
 *   put:
 *     description: Updates an existing server.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/ServerData'
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: Server updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoServerData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
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
      .status(403)
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
                "Game Server did not respond in time. However, we have still updated the server successfully.",
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

/**
 * @swagger
 *
 * /servers:
 *   delete:
 *     description: Delete a server object.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              server_id:
 *                type: integer
 *                required: true
 *     tags:
 *       - servers
 *     responses:
 *       200:
 *         description: Server deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res, next) => {
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
      .status(403)
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
