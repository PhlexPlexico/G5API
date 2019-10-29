/** Express API router for teams in get5.
 * @module routes/teams
 * @requires express
 * @requires db
 */
var express = require("express");
/** Express module
 * @const
 */
const router = express.Router();
/** Database module.
 * @const
 */
const db = require("../db");

/** GET - Route serving to get all teams.
 * @name router.get('/')
 * @function
 * @memberof module:routes/teams
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get("/", function(req, res, next) {
  var sql =
    "SELECT t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "GROUP_CONCAT(ta.auth) as auths, " +
    "GROUP_CONCAT(ta.name) as preferred_names " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "GROUP BY t.name, t.flag, t.logo, t.tag, t.public_team";
  db.query(sql, function(err, rows) {
    if (err) {
      res.status(500).send({ error: "Something failed!" + err });
    }
    // Need to perform some data manipulation for each row to change the arrayBuffers to meaningful strings/JSON
    res.json(rows);
  });
});

router.get("/:teamid", function(req, res, next) {
  teamID = req.params.teamid;
  var sql =
    "SELECT t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "GROUP_CONCAT(ta.auth) as auths, " +
    "GROUP_CONCAT(ta.name) as preferred_names " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id  " +
    "where t.id = ?";

  db.query(sql, [teamID], function(err, rows) {
    if (err) {
      res.status(500).send({ error: "Something failed!" + err });
    }
    res.json(rows);
  });
});

/** POST - Route serving to insert a user into the database.
 * @name /create
 * @function
 * @memberof module:routes/teams
 * @param {number} req.body.user_id - Foreign key relation to a user in the database.
 * @param {string} req.body.name - Name inputted by a user.
 * @param {string} req.body.flag - International code for a flag.
 * @param {string} req.body.logo - A string representing the logo stored on the webserver.
 * @param {JSON} req.body.auths - A JSON array containing the Steam64 IDs for players.
 * @param {JSON} req.body.preferred_names - A JSON array containing the Steam64 IDs for players. 
                                            This must match the size of the auths if used. Use a blank value if a user does not wish to have a name.
 * @param {string} req.body.tag - A string with a shorthand tag for a team.
 * @param {number} req.body.public_team - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */

//TODO: Test the inserts, make sure lists are inserted as blobs.
router.post("/create", function(req, res, next) {
  var userID = req.body.user_id;
  var teamName = req.body.name;
  var flag = req.body.flag;
  var logo = req.body.logo;
  var auths = req.body.auths; // Sent into here as a list? Verify somehow?
  var tag = req.body.tag;
  var public_team = req.body.public_team;
  var pref_names = req.body.preferred_names; // Sent in as list, do we worry about verification? Probably.
  var teamID = NULL;
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
  // https://github.com/mysqljs/mysql/issues/814#issuecomment-418659750 reference for insert. Need to do things a little differently.
  var sql = "INSERT INTO team SET ?";
  db.query(
    sql,
    [
      newTeam.map(
        team.user_id,
        team.name,
        team.flag,
        team.logo,
        team.tag,
        team.public_team
      )
    ],
    function(err, result) {
      if (err) {
        res.status(500).send({ error: "Something failed!" + err });
      }
      teamID = result.insertId;
      // res.json({ message: "Team created successfully" });
    }
  );
  // TODO: Insert values into the normalized table. Need to think of inexpensive way of inserting. Bulk insert?

  sql = "INSERT INTO team_auth_names (team_id, auth, name) VALUES ?";
  // Create object.
  var result = {};
  auths.forEach((auth, i) => (result[auth] = name[i]));
  for (let [key, value] of Object.entries(result)) {
    db.query(sql, [teamid, key, value], function(err, result) {
      if (err) {
        res.status(500).send({ error: "Something failed!" + err });
      }
    });
  }
  res.json({ message: "Team created successfully" });
});

//TODO: Finish update statement.
/** PUT - Route serving to update a user admin privilege in the application. Submit through form to update the required data.
 * @name /update
 * @function
 * @memberof module:routes/teams
 * @param {int} req.body.id - the Team id stored in the database..
 * @param {string} req.body.name - Steam ID of the user being created.
 * @param {string} req.body.flag - International Flag code by Steam.
 * @param {string} req.body.logo - Integer determining if a user is a super admin of the system. Either 1 or 0.
 * @param {list} req.body.auths - An object of type list containing all steam 64 auths on a team.
 * @param {string} req.body.tag - A string with a shorthand tag for a team.
 * @param {number} req.body.public_team - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @param {list} req.body.preferred_names - List containing a 1:1 relation to user auths.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */
router.put("/update", function(req, res, next) {
  var columns = [];
  var values = [];
  var team_id = req.body.id;
  var queryStr;

  if (typeof req.body.name !== "undefined")
    columns.push("name = " + req.body.name);

  if (typeof req.body.flag !== "undefined")
    columns.push("flag = " + req.body.flag);

  if (typeof req.body.logo !== "undefined")
    columns.push("logo = " + req.body.logo);

  if (typeof req.body.tag !== "undefined")
    columns.push("tag = " + req.body.tag);

  if (typeof req.body.public_team !== "public_team")
    columns.push("public_team = " + req.body.public_team);

  var sql = "UPDATE team SET " + columns + " WHERE id=?";
  db.query(sql, [team_id], function(err, result) {
    if (err) {
      res.status(500).send({ error: "Something failed!" + err });
    }
    //res.json({ message: "Team edited successfully" });
  });
  // TODO: Check if team was edited, and if anyone was removed or added.
});

//TODO: Various getters/setters are needed to be imported from Get5-Web. Please see https://github.com/PhlexPlexico/get5-web/blob/master/get5/models.py

module.exports = router;
