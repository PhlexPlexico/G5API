/** Express API router for teams in get5.
 * @module routes/teams
 * @requires express
 * @requires db
 */
let express = require("express");
/** Express module
 * @const
 */
const router = express.Router();
/** Database module.
 * @const
 */
const db = require("../db");


/** Utility class for various methods used throughout.
* @const */
const Utils = require('../utility/utils');

/** GET - Route serving to get all teams.
 * @name router.get('/')
 * @function
 * @memberof module:routes/teams
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/", async (req, res) => {
  let sql =
    "SELECT t.id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': [\"', ta.name, '\"]')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "GROUP BY t.id, t.name, t.flag, t.logo, t.tag, t.public_team";
  try {
    let allTeams = await db.query(sql);
    // do something with someRows and otherRows
    for(let row in allTeams){
      allTeams[row].auth_name = JSON.parse(allTeams[row].auth_name);
      allTeams[row].auth_name = await getTeamImages(allTeams[row].auth_name);
    }
    res.json(allTeams);
  } catch (err) {
    res.json({ message: err });
  }
});


/** GET - Route serving to get an auth'd users teams.
 * @name router.get('/myteams')
 * @function
 * @memberof module:routes/teams
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/myteams", Utils.ensureAuthenticated, async (req, res) => {
  let sql =
    "SELECT t.id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "WHERE t.user_id = ?" +
    "GROUP BY t.name, t.flag, t.logo, t.tag, t.public_team";
  try {
    const allTeams = await db.query(sql, [req.user.id]);
    for(let row in allTeams){
      allTeams[row].auth_name = JSON.parse(allTeams[row].auth_name);
      allTeams[row].auth_name = await getTeamImages(allTeams[row].auth_name);
    }
    res.json(allTeams);
  } catch (err) {
    res.json({ message: err });
  }
});

/** GET - Route serving to get team with an ID.
 * @name router.get('/:team_id')
 * @function
 * @memberof module:routes/teams
 * @param {number} teamid - The team ID you wish to examine.
 */
router.get("/:team_id", async (req, res) => {
  teamID = req.params.team_id;
  let sql =
    "SELECT t.id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id  " +
    "where t.id = ?";
  try {
    const allTeams = await db.query(sql, teamID);
    // Oddly enough, if a team doesn't exist, it still returns null!
    // Check this and return a 404 if we don't exist.
    if(allTeams[0].id === null) {
      res.status(404).json({message: "No team found for id " + teamID});
      return;
    }
    allTeams[0].auth_name = JSON.parse(allTeams[0].auth_name);
    res.json(allTeams);
  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/** POST - Route serving to insert a team into the database.
 * @name router.post('/create')
 * @function
 * @memberof module:routes/teams
 * @param {number} req.body[0].user_id - The ID of the user creating the team to claim ownership.
 * @param {string} req.body[0].name - Team name inputted by a user.
 * @param {string} req.body[0].flag - International code for a flag.
 * @param {string} req.body[0].logo - A string representing the logo stored on the webserver.
 * @param {JSON} req.body[0].auth_name - A JSON KV pair containing the SteamID of a player as the key, and a value, or blank string value as the preferred name.
 * @param {string} req.body[0].tag - A string with a shorthand tag for a team.
 * @param {number} req.body[0].public_team - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */

router.post("/create", Utils.ensureAuthenticated, async (req, res) => {
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

/** PUT - Route serving to udpate a team into the database.
 * @name router.put('/update')
 * @function
 * @memberof module:routes/teams
 * @param {number} req.user.id - The ID of the user updating values.
 * @param {number} req.body[0].id - The ID of the team to be updated.
 * @param {number} [req.body[0].user_id] - The ID to update the user parameter.
 * @param {string} [req.body[0].name] - Team name inputted by a user.
 * @param {string} [req.body[0].flag] - International code for a flag.
 * @param {string} [req.body[0].logo] - A string representing the logo stored on the webserver.
 * @param {JSON} [req.body[0].auth_name] - A JSON KV pair containing the SteamID of a player as the key, and a value, or blank string value as the preferred name. If no preferred name, than an empty string accompnies the value.
 * @param {string} [req.body[0].tag] - A string with a shorthand tag for a team.
 * @param {number} [req.body[0].public_team] - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */
router.put("/update", Utils.ensureAuthenticated, async (req, res) => {
  let checkUserSql = "SELECT * FROM team WHERE id = ?";
  const checkUser = await db.query(checkUserSql, [req.body[0].id]);
  if(checkUser[0] == null) {
    res.status(404).json({message: "Team does not exist."});
    return;
  } else if (checkUser[0].user_id != req.user.id && !(Utils.superAdminCheck(req.user))) {
    res.status(401).json({message: "User is not authorized to perform action."});
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

/** DELETE - Route serving to delete a team from the database. The team will only be deleted if their foreign key references have been removed, as we want to keep statistics of all teams over time.
 * @name router.delete('/delete')
 * @function
 * @memberof module:routes/teams
 * @param {number} req.body[0].team_id - The ID of the team being updated.
 */
router.delete("/delete/", Utils.ensureAuthenticated, async (req, res) => {
  let teamID = req.body[0].team_id;
  let checkUserSql = "SELECT * FROM team WHERE id = ?";
  const checkUser = await db.query(checkUserSql, [teamID]);
  if(checkUser[0] == null) {
    res.status(404).json({message: "Team does not exist."});
    return;
  } else if (checkUser[0].user_id != req.user.id && !(Utils.superAdminCheck(req.user))) {
    res.status(401).json({message: "User is not authorized to perform action."});
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


/** GET - Route serving to get a teams recent matches.
 * @name router.get('/:team_id/recent')
 * @function
 * @memberof module:routes/teams
 * @param {number} teamid - The team ID you wish to examine.
 */
router.get("/:team_id/recent", async(req, res) => {
  try {
    teamId = req.params.team_id;
    let sql = "SELECT rec_matches.* FROM team t, `match` rec_matches WHERE t.id = ? AND (rec_matches.team1_id = ? OR rec_matches.team2_id = ?) ORDER BY rec_matches.id DESC LIMIT 5";
    const recentMatches = await db.query(sql, [teamId, teamId, teamId]);
    res.json(recentMatches);
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
    if (curMatch[0].team1_id === teamId){
      otherTeam = await db.query(teamSql, [curMatch[0].team2_id]);
      myScore = curMatch[0].team1_score;
      otherTeamScore = curMatch[0].team2_score;
    } else {
      otherTeam = await db.query(teamSql, [curMatch[0].team1_id]);
      myScore = curMatch[0].team2_score;
      otherTeamScore = curMatch[0].team1_score;
    }
    // If match is a bo1, just get the map score.
    if (curMatch[0].max_maps === 1) {
      let mapSql = "SELECT team1_id, team1_score, team2_score FROM map_stats WHERE match_id = ? LIMIT 1";
      const mapStatBo1 = await db.query(mapSql, [matchId]);
      if (mapStatBo1.length > 0) {
        if (mapStatBo1[0].team1_id === teamId) {
          myScore = mapStatBo1[0].team1_score;
          otherTeamScore = mapStatBo1[0].team2_score;
        } else {
          myScore = mapStatBo1[0].team2_score;
          otherTeamScore = mapStatBo1[0].team1_score;
        }
      }
    }
    // Start building the return string.
    if (curMatch[0].end_time === null && (curMatch[0].cancelled === false || curMatch[0].cancelled === null) && curMatch[0].start_time !== null)
        statusString = "Live, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    else if (myScore < otherTeamScore) 
      statusString = "Lost, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    else if (myScore > otherTeamScore) 
      statusString = "Won, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    else
      statusString = "Tied, "+ myScore + ":" + otherTeamScore + " vs " + otherTeam[0].name;
    res.json({"result" : statusString});

  } catch (err) {
    res.status(500).json({ message: err.toString() });
  }
});

/* Helper Functions */
const getTeamImages = async (idList) => {
  for(let steamId of Object.keys(idList)){
    if(idList[steamId][0] == "")
    idList[steamId][0] = await Utils.getSteamName(steamId);
    idList[steamId][1] = await Utils.getSteamImage(steamId);
  }
  console.log(idList);
  return idList;
}



module.exports = router;
