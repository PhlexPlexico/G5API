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

const Utils = require('../utility/utils');

/**
 * @swagger
 *
 * components:
 *   schemas:
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
 *          description: A string representing the logo stored on the webserver.
 *          required: false
 *        auth_name:
 *          type: object
 *          additional_properties:
 *            key:
 *              type: string
 *              description: Key value that is a Steam ID. Can be any steam identifier as it will convert to Steam64.
 *            value:
 *              type: string
 *              description: Name that the user wishes to be called. Can be left null and will use Steam name.
 *            description: Key value pair representing the players in a team.
 *            required: false
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
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "GROUP BY t.id, t.name, t.flag, t.logo, t.tag, t.public_team";
  try {
    let teams = await db.query(sql);
    // do something with someRows and otherRows
    if(teams.length < 1){
      res.
        status(404).
        json({message: "No teams found for current user."});
      return;
    }
    for(let row in teams){
      teams[row].auth_name = JSON.parse(teams[row].auth_name);
      teams[row].auth_name = await getTeamImages(teams[row].auth_name, false);
    }
    res.json({teams});
  } catch (err) {
    res.status(500).json({ message: err });
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
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "WHERE t.user_id = ? " +
    "GROUP BY t.name, t.flag, t.logo, t.tag, t.public_team";
  try {
    const teams = await db.query(sql, [req.user.id]);
    if(teams.length < 1){
      res.
        status(404).
        json({message: "No teams found for current user."});
      return;
    }
    for(let row in teams){
      teams[row].auth_name = JSON.parse(teams[row].auth_name);
      teams[row].auth_name = await getTeamImages(teams[row].auth_name, false);
    }
    res.json({teams});
  } catch (err) {
    res.status(500).json({ message: err });
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
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': { \"name\": \"', ta.name, '\"}')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id  " +
    "where t.id = ?";
  try {
    let team = await db.query(sql, teamID);
    // Oddly enough, if a team doesn't exist, it still returns null!
    // Check this and return a 404 if we don't exist.
    if(team[0].id === null) {
      res.status(404).json({message: "No team found for id " + teamID});
      return;
    }
    team[0].auth_name = JSON.parse(team[0].auth_name);
    team[0].auth_name = await getTeamImages(team[0].auth_name);
    team = JSON.parse(JSON.stringify(team[0]));
    res.json({team});
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
  let userID = req.user.id;
  let teamName = req.body[0].name;
  let flag = req.body[0].flag;
  let logo = req.body[0].logo;
  let auths = req.body[0].auth_name;
  let tag = req.body[0].tag;
  let public_team = req.body[0].public_team;
  let teamID = null;
  newTeam = [
    {
      user_id: userID,
      name: teamName,
      flag: flag,
      logo: logo,
      tag: tag,
      public_team: public_team
    }
  ];
  let sql =
    "INSERT INTO team (user_id, name, flag, logo, tag, public_team) VALUES ?";

  try {
    await db.withTransaction(async () => {
      const insertTeam = await db.query(sql, [
        newTeam.map(item => [
          item.user_id,
          item.name,
          item.flag,
          item.logo,
          item.tag,
          item.public_team
        ])
      ]);
      teamID = insertTeam.insertId;
      sql =
        "INSERT INTO team_auth_names (team_id, auth, name) VALUES (?, ?, ?)";
      for (let key in auths) {
        let usersSteamId = await Utils.getSteamPID(key);
        await db.query(sql, [teamID, usersSteamId, auths[key]]);
      }
      res.json({ message: "Team successfully inserted with ID " + teamID });
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
  const checkUser = await db.query(checkUserSql, [req.body[0].id]);
  if(checkUser[0] == null) {
    res.status(404).json({message: "Team does not exist."});
    return;
  } else if (checkUser[0].user_id != req.user.id && !(Utils.superAdminCheck(req.user))) {
    res.status(403).json({message: "User is not authorized to perform action."});
    return;
  }
  let teamID = req.body[0].id;
  let teamName = req.body[0].name;
  let teamFlag = req.body[0].flag;
  let teamLogo = req.body[0].logo;
  let teamAuths = req.body[0].auth_name;
  let teamTag = req.body[0].tag;
  let publicTeam = req.body[0].public_team;
  let userId = req.body[0].user_id;
  let updateTeam = {
      user_id: userId,
      name: teamName,
      flag: teamFlag,
      logo: teamLogo,
      tag: teamTag,
      public_team: publicTeam
    };
    updateTeam = await db.buildUpdateStatement(updateTeam);
    if(Object.keys(updateTeam).length === 0){
      res.status(412).json({message: "No update data has been provided."});
      return;
    }
  let sql =
    "UPDATE team SET ? WHERE id=?";
  try {
    await db.withTransaction(async () => {
      await db.query(sql, [
        updateTeam,
        teamID
      ]);
      sql =
        "UPDATE team_auth_names SET name = ? WHERE auth = ? AND team_id = ?";
      for (let key in teamAuths) {
        let usersSteamId = await Utils.getSteamPID(key);
        let updateTeamAuth = await db.query(sql, [teamAuths[key], usersSteamId, teamID]);
        if(updateTeamAuth.affectedRows < 1){
          // Insert a new auth if it doesn't exist. Technically "updating a team".
          let insertSql = "INSERT INTO team_auth_names (team_id, auth, name) VALUES (?, ?, ?)";
          await db.query(insertSql, [teamID, usersSteamId, teamAuths[key]]);
        }
      }
      res.json({ message: "Team successfully updated" });
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /teams:
 *   delete:
 *     description: Delete a team object if there is no map stats associated with it.
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
  let teamID = req.body[0].team_id;
  let checkUserSql = "SELECT * FROM team WHERE id = ?";
  const checkUser = await db.query(checkUserSql, [teamID]);
  if(checkUser[0] == null) {
    res.status(404).json({message: "Team does not exist."});
    return;
  } else if (checkUser[0].user_id != req.user.id && !(Utils.superAdminCheck(req.user))) {
    res.status(403).json({message: "User is not authorized to perform action."});
    return;
  }
  try {
    // First find any matches/mapstats/playerstats associated with the team.
    let playerStatSql =
      "SELECT COUNT(*) as RECORDS FROM player_stats WHERE team_id = ?";
    let mapStatSql =
      "SELECT COUNT(*) as RECORDS FROM map_stats WHERE winner = ?";
    let matchSql =
      "SELECT COUNT(*) as RECORDS FROM `match` WHERE team1_id = ? OR team2_id = ?";
    const playerStatCount = await db.query(playerStatSql, teamID);
    const mapStatCount = await db.query(mapStatSql, teamID);
    const matchCount = await db.query(matchSql, [teamID, teamID]);
    if (
      playerStatCount[0].RECORDS > 0 ||
      mapStatCount[0].RECORDS > 0 ||
      matchCount[0].RECORDS > 0
    ) {
      throw "Cannot delete team as it has more than one of the following true:\n" +
        "Player Stat Records: " +
        playerStatCount[0].RECORDS +
        "\n" +
        "Map Stat Records: " +
        mapStatCount[0].RECORDS +
        "\n" +
        "Match Records: " +
        matchCount[0].RECORDS;
    }
    // Otherwise, let's continue with delete. Start with auths.
    await db.withTransaction(async () => {
      let deleteTeamAuthSql = "DELETE FROM team_auth_names WHERE team_id = ?";
      let deleteTeamsql = "DELETE FROM team WHERE id = ?";
      await db.query(deleteTeamAuthSql, teamID);
      await db.query(deleteTeamsql, teamID);
    });
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
  res.json({ message: "Team has been deleted successfully!" });
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
router.get("/:team_id/recent", async(req, res) => {
  try {
    teamId = req.params.team_id;
    let sql = "SELECT rec_matches.* FROM team t, `match` rec_matches WHERE t.id = ? AND (rec_matches.team1_id = ? OR rec_matches.team2_id = ?) ORDER BY rec_matches.id DESC LIMIT 5";
    const matches = await db.query(sql, [teamId, teamId, teamId]);
    res.json({matches});
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
router.get("/:team_id/result/:match_id", async(req, res) => {
  try {
    let otherTeam = null;
    let myScore = 0;
    let otherTeamScore = 0;
    let matchId = req.params.match_id;
    let teamId = req.params.team_id;
    let matchSql = "SELECT * FROM `match` WHERE id = ?";
    let teamSql = "SELECT * FROM team WHERE id = ?";
    let statusString = "";
    const curMatch = await db.query(matchSql, [matchId]);
    if (curMatch.length === 0){
      res.status(404).json({"result": "Team did not participate in match."});
      return;
    }
    if (curMatch[0].team1_id == teamId){
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
      let mapSql = "SELECT team1_score, team2_score FROM map_stats WHERE match_id = ? LIMIT 1";
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
    // Start building the return string.
    if (curMatch[0].end_time == null && (curMatch[0].cancelled == false || curMatch[0].cancelled == null) && curMatch[0].start_time != null)
        statusString = "Live, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    else if (myScore < otherTeamScore) 
      statusString = "Lost, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    else if (myScore > otherTeamScore) 
      statusString = "Won, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    else if (curMatch[0].winner != null)
      statusString = "Forfeit win vs " + otherTeam[0].name;
    else
      statusString = "Tied, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    res.json({"result" : statusString});

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
const getTeamImages = async (idList, getImage=true) => {
  for(let steamId of Object.keys(idList)){
    if(!getImage){
      if(idList[steamId] == "") {
        idList[steamId] = await Utils.getSteamName(steamId);
      }
    } else {
      if(idList[steamId].name == "") {
        idList[steamId].name = await Utils.getSteamName(steamId);
      }
      idList[steamId].image = await Utils.getSteamImage(steamId);
    }
    
  }
  return idList;
}



module.exports = router;
