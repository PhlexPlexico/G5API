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
      const allTeams = await db.query( sql );
      // do something with someRows and otherRows
      allTeams.forEach((row) => {
        row.auth_name = JSON.parse(row.auth_name);
      });
      res.json(allTeams);
    } catch ( err ) {
      res.json({message: err});
    }
});

/** GET - Route serving to get all teams.
 * @name /
 * @function
 * @memberof module:routes/teams
 * @param {int} teamid - The team ID you wish to examine.
 */
router.get("/:teamid", async (req, res, next) => {
  teamID = req.params.teamid;
  let sql =
    "SELECT t.id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id  " +
    "where t.id = ?";
    try {
      const allTeams = await db.query( sql, teamID );
      // do something with someRows and otherRows
      allTeams[0].auth_name = JSON.parse(allTeams[0].auth_name)
      res.json(allTeams);
    } catch ( err ) {
      res.status(500).json({message: err});
    }
});

/** POST - Route serving to insert a user into the database.
 * @name /create
 * @function
 * @memberof module:routes/teams
 * @param {string} req.body[0].data- Crafted JSON Data sent as it is received via get.
 * @param {string} req.body[0].name - Name inputted by a user.
 * @param {string} req.body[0].flag - International code for a flag.
 * @param {string} req.body[0].logo - A string representing the logo stored on the webserver.
 * @param {JSON} req.body[0].auth_name - A JSON KV pair containing the SteamID of a player as the key, and a value, or blank string value as the preferred name.
 * @param {JSON} req.body[0].preferred_names - A JSON array containing the Steam64 IDs for players. 
                                            This must match the size of the auths if used. Use a blank value if a user does not wish to have a name.
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
  let sql = "INSERT INTO team (user_id, name, flag, logo, tag, public_team) VALUES ?";

  try {
    await withTransaction( db, async () => {
      const insertTeam = await db.query( sql, [newTeam.map(item => [item.user_id, item.name, item.flag, item.logo, item.tag, item.public_team])] );
      teamID = insertTeam.insertId;
      sql = "INSERT INTO team_auth_names (team_id, auth, name) VALUES (?, ?, ?)";
      console.log("We made it past the first insert.")
      for(let key in auths){
        await db.query( sql, [teamID, key, auths[key]]);
      }
      res.json({message: "Team successfully inserted with ID " + teamID});
    });
  } catch ( err ) {
    res.status(500).json({message: err});
  }
});

// TODO - Update documentation.
/** PUT - Route serving to update a user admin privilege in the application. Submit through form to update the required data.
 * @name /update
 * @function
 * @memberof module:routes/teams
 * @param {int} req.body[0].id - the Team id stored in the database.
 * @param {int} req.body[0].steam_id - The Steam ID of the user making the change.
 * @param {string} req.body[0].name - Steam ID of the user being created.
 * @param {string} req.body[0].flag - International Flag code by Steam.
 * @param {string} req.body[0].logo - Integer determining if a user is a super admin of the system. Either 1 or 0.
 * @param {JSON} req.body[0].auth_name - An object of type list containing all steam 64 auths on a team.
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
  let sql = "UPDATE team SET name = ?, flag = ?, logo = ?, tag = ?, public_team = ? WHERE id=? and user_id = ?";
  try {
    await withTransaction( db, async () => {
      await db.query( sql, [newTeam.map(item => [item.name, item.flag, item.logo, item.tag, item.public_team, item.user_id])] );
      sql = "UPDATE team_auth_names SET name = ? WHERE auth = ? AND team_id = ?";
      for(let key in teamAuths){
        await db.query( sql, [auths[key], key, teamID]);
      }
      res.json({message: "Team successfully updated" });
    });
  } catch ( err ) {
    res.status(500).json({message: err});
  }
});

// TODO: DELETE STMT. Check if team has matches, return not allowed if they have matches in their name.
router.delete('/delete', async (req,res,next) => {
  res.status(500).json({message: "NOT IMPLEMENTED."});
});

async function withTransaction( db, callback ) {
  try {
    await db.beginTransaction();
    await callback();
    await db.commit();
  } catch ( err ) {
    await db.rollback();
    throw err;
  } finally {
    await db.close();
  }
}

//TODO: letious getters/setters are needed to be imported from Get5-Web. Please see https://github.com/PhlexPlexico/get5-web/blob/master/get5/models.py

module.exports = router;
