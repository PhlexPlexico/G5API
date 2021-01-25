/** Express API router for teams in get5.
 * @module routes/teams
 * @requires express
 * @requires db
 */

/**
 * @swagger
 * resourcePath: /teams
 * description: Express API router for teams in get5.
 */
let express = require("express");

const router = express.Router();

const db = require("../db");

const Utils = require("../utility/utils");

const randString = require("randomstring");

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     AuthObject:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name that the user wishes to be called. Can be left null and will use Steam name.
 *         captain:
 *           type: boolean
 *           description: Boolean value representing if a user is a team captain or not.
 *
 *     TeamData:
 *      type: object
 *      required:
 *        - team_id
 *      properties:
 *        team_id:
 *          type: integer
 *          description: The unique ID of a team.
 *        name:
 *          type: string
 *          description: The name of the team.
 *          required: true
 *        flag:
 *          type: string
 *          description: Country code flag used in game. See https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 *          required: false
 *        logo:
 *          type: string
 *          format: byte
 *          description: A base64 png or svg to save to disk.
 *          required: false
 *        auth_name:
 *          type: object
 *          additionalProperties:
 *            $ref: "#/components/schemas/AuthObject"
 *
 *        tag:
 *          type: string
 *          description: A string with a shorthand tag for a team.
 *          required: false
 *   responses:
 *     NoTeamData:
 *       description: No team data was provided.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /teams/:
 *   get:
 *     description: Get all teams registered on get5.
 *     produces:
 *       - application/json
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  teams:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/TeamData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res) => {
  let sql =
    "SELECT t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': " +
    "{ \"name\": \"', ta.name, '\", \"captain\": \"', ta.captain, '\"}') ORDER BY ta.captain desc, ta.id  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t LEFT OUTER JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "GROUP BY t.id";
  try {
    let teams = await db.query(sql);
    // let teamAuths = await db.query(authNameSql, teamID);
    // Oddly enough, if a team doesn't exist, it still returns null!
    // Check this and return a 404 if we don't exist.
    if (teams.length < 1) {
      res.status(404).json({ message: "No teams found in the system." });
      return;
    }
    for (let row in teams) {
      if (teams[row].auth_name != null) {
        teams[row].auth_name = JSON.parse(teams[row].auth_name);
        teams[row].auth_name = await getTeamImages(teams[row].auth_name, false);
      }
    }
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams/myteams:
 *   get:
 *     description: Set of teams from the logged in user.
 *     produces:
 *       - application/json
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  type: array
 *                  teams:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/TeamData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/myteams", Utils.ensureAuthenticated, async (req, res) => {
  let sql =
    "SELECT t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': " +
    "{ \"name\": \"', ta.name, '\", \"captain\": ', ta.captain, '}') ORDER BY ta.captain desc, ta.id  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t LEFT OUTER JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "WHERE t.user_id = ? " +
    "GROUP BY t.id";
  try {
    let teams = await db.query(sql, req.user.id);
    // let teamAuths = await db.query(authNameSql, teamID);
    // Oddly enough, if a team doesn't exist, it still returns null!
    // Check this and return a 404 if we don't exist.
    if (teams.length == 0) {
      res.status(404).json({ message: "No teams found for " + req.user.name });
      return;
    }
    for (let row in teams) {
      if (teams[row].auth_name != null) {
        teams[row].auth_name = JSON.parse(teams[row].auth_name);
        teams[row].auth_name = await getTeamImages(teams[row].auth_name, false);
      }
    }
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams/:team_id:
 *   get:
 *     description: Returns a provided teams info.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: team_id
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: Team info
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  team:
 *                    $ref: '#/components/schemas/TeamData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:team_id", async (req, res) => {
  teamID = req.params.team_id;
  let sql =
    "SELECT t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': " +
    "{ \"name\": \"', ta.name, '\", \"captain\": ', ta.captain, '}') ORDER BY ta.captain desc, ta.id  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t LEFT OUTER JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "WHERE t.id = ? " +
    "GROUP BY t.id";
  try {
    let team = await db.query(sql, teamID);
    // Oddly enough, if a team doesn't exist, it still returns null!
    // Check this and return a 404 if we don't exist.
    if (team.length == 0) {
      res.status(404).json({ message: "No team found for id " + teamID });
      return;
    }
    // If we're an empty set, try just getting the team basic info.

    if (team[0].auth_name != null) {
      team[0].auth_name = JSON.parse(team[0].auth_name);
      team[0].auth_name = await getTeamImages(team[0].auth_name);
    }
    team = JSON.parse(JSON.stringify(team[0]));
    res.json({ team });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams/:team_id/basic:
 *   get:
 *     description: Returns a provided teams top-level info, no team names/steamid returned..
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: team_id
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: Team info
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  team:
 *                    $ref: '#/components/schemas/TeamData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:team_id/basic", async (req, res) => {
  teamID = req.params.team_id;
  let sql =
    "SELECT t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team, '' as auth_name " +
    "FROM team t WHERE t.id = ?";
  try {
    let team = await db.query(sql, teamID);
    // Oddly enough, if a team doesn't exist, it still returns null!
    // Check this and return a 404 if we don't exist.
    if (team.length == 0) {
      res.status(404).json({ message: "No team found for id " + teamID });
      return;
    }
    team = JSON.parse(JSON.stringify(team[0]));
    res.json({ team });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams:
 *   post:
 *     description: Creates a new team to use.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/TeamData'
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: Team created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res) => {
  let newSingle = await db.getConnection();
  let userID = req.user.id;
  let teamName = req.body[0].name;
  let flag = req.body[0].flag;
  let logo = req.body[0].logo_file;
  let logoName = null;
  let auths = req.body[0].auth_name;
  let tag = req.body[0].tag;
  let public_team = req.body[0].public_team;
  let teamID = null;
  if (logo) {
    // Generate a 5 character logo "name".
    logoName = randString.generate({
      length: 5,
      charset: "alphanumeric",
    });
    let base64Data = logo.replace(/^data:image\/png;base64,/, "");
    require("fs").writeFile(
      "public/img/logos/" + logoName + ".png",
      base64Data,
      "base64",
      function (err) {
        if(err)
          console.log(err);
      }
    );
  }
  newTeam = [
    {
      user_id: userID,
      name: teamName,
      flag: flag,
      logo: logoName,
      tag: tag,
      public_team: public_team,
    },
  ];
  let sql =
    "INSERT INTO team (user_id, name, flag, logo, tag, public_team) VALUES ?";

  try {
    await db.withNewTransaction(newSingle, async () => {
      const insertTeam = await newSingle.query(sql, [
        newTeam.map((item) => [
          item.user_id,
          item.name,
          item.flag,
          item.logo,
          item.tag,
          item.public_team,
        ]),
      ]);
      teamID = insertTeam[0].insertId;
      sql =
        "INSERT INTO team_auth_names (team_id, auth, name, captain) VALUES (?, ?, ?, ?)";
      for (let key in auths) {
        let isCaptain = auths[key].captain == null ? 0 : auths[key].captain;
        let usersSteamId = await Utils.getSteamPID(key);
        await newSingle.query(sql, [
          teamID,
          usersSteamId,
          auths[key].name,
          isCaptain,
        ]);
      }
      res.json({ message: "Team successfully inserted.", id: teamID });
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams:
 *   put:
 *     description: Creates a new team to use.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/TeamData'
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: Team updated successfully.
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
 *         $ref: '#/components/responses/NoTeamData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res) => {
  let checkUserSql = "SELECT * FROM team WHERE id = ?";
  let newSingle = await db.getConnection();
  const checkUser = await db.query(checkUserSql, [req.body[0].id]);
  if (checkUser[0] == null) {
    res.status(404).json({ message: "Team does not exist." });
    return;
  } else if (
    checkUser[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  }
  let teamID = req.body[0].id;
  let teamName = req.body[0].name;
  let teamFlag = req.body[0].flag;
  let teamLogo = req.body[0].logo_file;
  let logoName = null;
  let teamAuths = req.body[0].auth_name;
  let teamTag = req.body[0].tag;
  let publicTeam = req.body[0].public_team;
  let userId = req.body[0].user_id;
  let updateTeam = {
    user_id: userId,
    name: teamName,
    flag: teamFlag,
    logo: logoName,
    tag: teamTag,
    public_team: publicTeam,
    id: teamID,
  };
  if (teamLogo) {
    // Overwrite the current file.
    if (checkUser[0].logo == null) {
      logoName = randString.generate({
        length: 5,
        charset: "alphanumeric",
      });
    } else {
      logoName = checkUser[0].logo;
    }
    let base64Data = teamLogo.replace(/^data:image\/png;base64,/, "");
    require("fs").writeFile(
      "public/img/logos/" + logoName + ".png",
      base64Data,
      "base64",
      function (err) {
        if(err)
          console.log(err);
      }
    );
    updateTeam.logo = logoName;
  }
  updateTeam = await db.buildUpdateStatement(updateTeam);
  if (Object.keys(updateTeam).length === 0) {
    res.status(412).json({ message: "No update data has been provided." });
    return;
  }
  let sql = "UPDATE team SET ? WHERE id=?";
  try {
    await db.withNewTransaction(newSingle, async () => {
      await newSingle.query(sql, [updateTeam, teamID]);
      sql =
        "UPDATE team_auth_names SET name = ?, captain = ? WHERE auth = ? AND team_id = ?";
      for (let key in teamAuths) {
        let isCaptain =
          teamAuths[key].captain == null ? 0 : teamAuths[key].captain;
        let usersSteamId = await Utils.getSteamPID(key);
        let updateTeamAuth = await newSingle.query(sql, [
          teamAuths[key].name,
          isCaptain,
          usersSteamId,
          teamID,
        ]);
        if (updateTeamAuth[0].affectedRows < 1) {
          // Insert a new auth if it doesn't exist. Technically "updating a team".
          let insertSql =
            "INSERT INTO team_auth_names (team_id, auth, name, captain) VALUES (?, ?, ?, ?)";
          await newSingle.query(insertSql, [
            teamID,
            usersSteamId,
            teamAuths[key].name,
            isCaptain,
          ]);
        }
      }
      res.json({ message: "Team successfully updated" });
    });
  } catch (err) {
    console.log(err.toString());
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams:
 *   delete:
 *     description: Delete a team object if there is no map stats associated with it. Optionally deletes a team member from a team, if a steam ID is provided.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              team_id:
 *                type: integer
 *                required: true
 *              steam_id:
 *                type: string
 *                required: false
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: Team deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", Utils.ensureAuthenticated, async (req, res) => {
  let newSingle = await db.getConnection();
  let teamID = req.body[0].team_id;
  let checkUserSql = "SELECT * FROM team WHERE id = ?";
  const checkUser = await db.query(checkUserSql, [teamID]);
  if (checkUser[0] == null) {
    res.status(404).json({ message: "Team does not exist." });
    return;
  } else if (
    checkUser[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else if (req.body[0].steam_id != null) {
    let deleteSql =
      "DELETE FROM team_auth_names WHERE auth = ? AND team_id = ?";
    let steamAuth = req.body[0].steam_id;
    try {
      await db.query(deleteSql, [steamAuth, teamID]);
      res.json({ message: "Team member deleted successfully!" });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  } else {
    try {
      // Remove file if exists.
      if (checkUser[0].logo) {
        require("fs").unlink("public/img/logos/" + checkUser[0].logo+".png", (err) => {
          if (err) {
            console.log(err);
          }
        });
      }
      await db.withNewTransaction(newSingle, async () => {
        let deleteTeamAuthSql = "DELETE FROM team_auth_names WHERE team_id = ?";
        let deleteTeamsql = "DELETE FROM team WHERE id = ?";
        await newSingle.query(deleteTeamAuthSql, teamID);
        await newSingle.query(deleteTeamsql, teamID);
      });
    } catch (err) {
      res.status(500).json({ message: err.toString() });
      return;
    }
    res.json({ message: "Team has been deleted successfully!" });
  }
});

/**
 * @swagger
 *
 * /teams/:team_id/recent:
 *   get:
 *     description: Returns last five recent matches by the team.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: team_id
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: Last five matches from the team.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                    $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:team_id/recent", async (req, res) => {
  try {
    teamId = req.params.team_id;
    let sql =
      "SELECT rec_matches.id, " +
      "rec_matches.user_id, " +
      "rec_matches.team1_id, " +
      "rec_matches.team2_id, " +
      "rec_matches.team1_string, " +
      "rec_matches.team2_string " +
      "FROM team t, `match` rec_matches " +
      "WHERE t.id = ? AND " +
      "(rec_matches.team1_id = ? OR rec_matches.team2_id = ?) " +
      "AND rec_matches.cancelled = 0 " +
      "ORDER BY rec_matches.id DESC LIMIT 5";
    const matches = await db.query(sql, [teamId, teamId, teamId]);
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** GET - Route serving to get a teams recent matches.
 * @name router.get('/:team_id/result/:match_id')
 * @function
 * @memberof module:routes/teams
 * @param {number} req.params.teamid - The team ID you wish to examine for results.
 * @param {number} req.params.matchid - The match ID you wish to examine for results.
 */
/**
 * @swagger
 *
 * /teams/:team_id/result/:match_id:
 *   get:
 *     description: Get the string result of a match that the team played.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: team_id
 *         required: true
 *         schema:
 *            type: integer
 *       - name: match_id
 *         required: true
 *         schema:
 *            type: integer
 *     tags:
 *       - teams
 *     responses:
 *       200:
 *         description: String representation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                    result:
 *                      type: string
 *                      description: Whether a team won, lost, or tied.
 *
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:team_id/result/:match_id", async (req, res) => {
  try {
    let otherTeam = null;
    let myScore = 0;
    let otherTeamScore = 0;
    let matchId = req.params.match_id;
    let teamId = req.params.team_id;
    let matchSql = "SELECT * FROM `match` WHERE id = ?";
    let teamSql = "SELECT * FROM team WHERE id = ?";
    let statusString = "";
    let otherName = "";
    const curMatch = await db.query(matchSql, [matchId]);
    if (curMatch.length === 0) {
      res.status(404).json({ result: "Team did not participate in match." });
      return;
    }
    if (curMatch[0].team1_id == teamId) {
      otherTeam = await db.query(teamSql, [curMatch[0].team2_id]);
      myScore = curMatch[0].team1_score;
      otherTeamScore = curMatch[0].team2_score;
    } else {
      otherTeam = await db.query(teamSql, [curMatch[0].team1_id]);
      myScore = curMatch[0].team2_score;
      otherTeamScore = curMatch[0].team1_score;
    }
    // If match is a bo1, just get the map score.
    if (curMatch[0].max_maps == 1) {
      let mapSql =
        "SELECT team1_score, team2_score FROM map_stats WHERE match_id = ? LIMIT 1";
      const mapStatBo1 = await db.query(mapSql, [matchId]);
      if (mapStatBo1.length > 0) {
        if (curMatch[0].team1_id == teamId) {
          myScore = mapStatBo1[0].team1_score;
          otherTeamScore = mapStatBo1[0].team2_score;
        } else {
          myScore = mapStatBo1[0].team2_score;
          otherTeamScore = mapStatBo1[0].team1_score;
        }
      }
    }
    if (otherTeam.length == 0) otherName = "Team Removed From Match";
    else otherName = otherTeam[0].name;
    if (
      curMatch[0].end_time == null &&
      (curMatch[0].cancelled == 0 || curMatch[0].cancelled == null) &&
      curMatch[0].start_time != null
    )
      statusString =
        "Live, " + myScore + ":" + otherTeamScore + " vs " + otherName;
    else if (myScore < otherTeamScore)
      statusString =
        "Lost, " + myScore + ":" + otherTeamScore + " vs " + otherName;
    else if (myScore > otherTeamScore)
      statusString =
        "Won, " + myScore + ":" + otherTeamScore + " vs " + otherName;
    else if (curMatch[0].winner != null)
      statusString = "Forfeit win vs " + otherName;
    else if (curMatch[0].cancelled == 1) {
      statusString = "Cancelled";
    } else
      statusString =
        "Tied, " + myScore + ":" + otherTeamScore + " vs " + otherName;
    res.json({ result: statusString });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/* Helper Functions */
/** Gets the steam image of each palyer.
 * @function
 * @memberof module:routes/teams
 * @param {Object} idList - An object list of steam IDs.
 */
const getTeamImages = async (idList, getImage = true) => {
  for (let steamId of Object.keys(idList)) {
    if (!getImage) {
      if (idList[steamId] == "") {
        idList[steamId] = await Utils.getSteamName(steamId);
      }
    } else {
      if (idList[steamId].name == "") {
        idList[steamId].name = await Utils.getSteamName(steamId);
      }
      idList[steamId].image = await Utils.getSteamImage(steamId);
    }
  }
  return idList;
};

module.exports = router;
