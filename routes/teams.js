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

/** GET - Route serving to get all teams.
 * @name /
 * @function
 * @memberof module:routes/teams
 */
router.get("/", async (req, res, next) => {
  let sql =
    "SELECT t.id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "GROUP BY t.name, t.flag, t.logo, t.tag, t.public_team";
  try {
    const allTeams = await db.query(sql);
    // do something with someRows and otherRows
    allTeams.forEach(row => {
      row.auth_name = JSON.parse(row.auth_name);
    });
    res.json(allTeams);
  } catch (err) {
    res.json({ message: err });
  }
});

/** GET - Route serving to get team with an ID.
 * @name router.get('/:team_id')
 * @function
 * @memberof module:routes/teams
 * @param {int} teamid - The team ID you wish to examine.
 */
router.get("/:team_id", async (req, res, next) => {
  teamID = req.params.team_id;
  let sql =
    "SELECT t.id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id  " +
    "where t.id = ?";
  try {
    const allTeams = await db.query(sql, teamID);
    // do something with someRows and otherRows
    allTeams[0].auth_name = JSON.parse(allTeams[0].auth_name);
    res.json(allTeams);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** POST - Route serving to insert a team into the database.
 * @name /create
 * @function
 * @memberof module:routes/teams
 * @param {int} req.body[0].user_id - The ID of the user creating the team to claim ownership.
 * @param {string} req.body[0].name - Team name inputted by a user.
 * @param {string} req.body[0].flag - International code for a flag.
 * @param {string} req.body[0].logo - A string representing the logo stored on the webserver.
 * @param {JSON} req.body[0].auth_name - A JSON KV pair containing the SteamID of a player as the key, and a value, or blank string value as the preferred name.
 * @param {string} req.body[0].tag - A string with a shorthand tag for a team.
 * @param {number} req.body[0].public_team - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */

router.post("/create", async (req, res, next) => {
  let userID = req.body[0].user_id;
  let teamName = req.body[0].name;
  let flag = req.body[0].flag;
  let logo = req.body[0].logo;
  let auths = req.body[0].auth_name; // Sent into here as a list? Verify somehow?
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
    await db.withTransaction(db, async () => {
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
      console.log("We made it past the first insert.");
      for (let key in auths) {
        await db.query(sql, [teamID, key, auths[key]]);
      }
      res.json({ message: "Team successfully inserted with ID " + teamID });
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** PUT - Route serving to udpate a team into the database.
 * @name /update
 * @function
 * @memberof module:routes/teams
 * @param {int} req.body[0].user_id - The ID of the user creating the team to claim ownership.
 * @param {string} req.body[0].name - Team name inputted by a user.
 * @param {string} req.body[0].flag - International code for a flag.
 * @param {string} req.body[0].logo - A string representing the logo stored on the webserver.
 * @param {JSON} req.body[0].auth_name - A JSON KV pair containing the SteamID of a player as the key, and a value, or blank string value as the preferred name. If no preferred name, than an empty string accompnies the value.
 * @param {string} req.body[0].tag - A string with a shorthand tag for a team.
 * @param {number} req.body[0].public_team - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */
router.put("/update", async (req, res, next) => {
  let teamID = req.body[0].id;
  let teamName = req.body[0].name;
  let teamFlag = req.body[0].flag;
  let teamLogo = req.body[0].logo;
  let teamAuths = req.body[0].auth_name;
  let teamTag = req.body[0].tag;
  let publicTeam = req.body[0].public_team;
  newTeam = [
    {
      user_id: userID,
      name: teamName,
      flag: teamFlag,
      logo: teamLogo,
      tag: teamTag,
      public_team: publicTeam
    }
  ];
  let sql =
    "UPDATE team SET name = ?, flag = ?, logo = ?, tag = ?, public_team = ? WHERE id=? and user_id = ?";
  try {
    await db.withTransaction(db, async () => {
      await db.query(sql, [
        newTeam.map(item => [
          item.name,
          item.flag,
          item.logo,
          item.tag,
          item.public_team,
          item.user_id
        ])
      ]);
      sql =
        "UPDATE team_auth_names SET name = ? WHERE auth = ? AND team_id = ?";
      for (let key in teamAuths) {
        await db.query(sql, [auths[key], key, teamID]);
      }
      res.json({ message: "Team successfully updated" });
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

/** DELETE - Route serving to delete a team from the database. The team will only be deleted if their foreign key references have been removed, as we want to keep statistics of all teams over time.
 * @name /delete/:team_id
 * @function
 * @memberof module:routes/teams
 * @param {int} req.params.team_id - The ID of the team to be deleted.
 */
router.delete("/delete/:team_id", async (req, res, next) => {
  let teamID = req.params.team_id;
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
    await db.withTransaction(db, async () => {
      let deleteTeamAuthSql = "DELETE FROM team_auth_names WHERE team_id = ?";
      let deleteTeamsql = "DELETE FROM team WHERE id = ?";
      await db.query(deleteTeamAuthSql, teamID);
      await db.query(deleteTeamsql, teamID);
    });
  } catch (err) {
    res.status(500).json({ message: err });
  }
  res.json({ message: "Team has been delete succesfully!" });
});


//TODO: various getters/setters are needed to be imported from Get5-Web. Please see https://github.com/PhlexPlexico/get5-web/blob/master/get5/models.py

module.exports = router;
