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
 * @name /
 * @function
 * @memberof module:routes/teams
 */
router.get("/", function(req, res, next) {
  var sql =
    "SELECT t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id " +
    "GROUP BY t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team";
  db.query(sql, function(err, rows) {
    if (err) {
      res.send({ error: "Something failed!" + err });
    }
    // Need to perform some data manipulation for each row to change the arrayBuffers to meaningful strings/JSON\
    rows.forEach(function(row) {
      row.auth_name = JSON.parse(row.auth_name);
    });

    res.json(rows);
  });
});

/** GET - Route serving to get all teams.
 * @name /
 * @function
 * @memberof module:routes/teams
 * @param {int} teamid - The team ID you wish to examine.
 */
router.get("/:teamid", function(req, res, next) {
  teamID = req.params.teamid;
  var sql =
    "SELECT t.id, t.user_id, t.name, t.flag, t.logo, t.tag, t.public_team, " +
    "CONCAT('{', GROUP_CONCAT( DISTINCT CONCAT('\"',ta.auth, '\"', ': \"', ta.name, '\"')  SEPARATOR ', '), '}') as auth_name " +
    "FROM team t JOIN team_auth_names ta " +
    "ON t.id = ta.team_id  " +
    "where t.id = ?";

  db.query(sql, [teamID], function(err, rows) {
    if (err) {
      res.send({ error: "Something failed!" + err });
    }
    rows[0].auth_name = JSON.parse(rows[0].auth_name);
    console.log(
      Object.values(rows[0].auth_name),
      Object.keys(rows[0].auth_name)
    );
    res.json(rows);
  });
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

//TODO: Test the inserts, make sure lists are inserted as blobs.
router.post("/create", function(req, res, next) {
  var userID = req.body[0].user_id;
  var teamName = req.body[0].name;
  var flag = req.body[0].flag;
  var logo = req.body[0].logo;
  var auths = req.body[0].auth_name;
  var tag = req.body[0].tag;
  var public_team = req.body[0].public_team;
  let teamID = null;
  var newTeam = [
    {
      user_id: userID,
      name: teamName,
      flag: flag,
      logo: logo,
      tag: tag,
      public_team: public_team
    }
  ];
  db.beginTransaction(err => {
    var sql =
      "INSERT INTO team (user_id, name, flag, logo, tag, public_team) VALUES ?";
    db.query(
      sql,
      [
        newTeam.map(item => [
          item.user_id,
          item.name,
          item.flag,
          item.logo,
          item.tag,
          item.public_team
        ])
      ],
      (err, result) => {
        if (err) {
          db.rollback(() => {
            console.log(err);
          });
          return res.send({ error: "Something failed!" + err });
        }
        teamID = result.insertId;
        sql = "INSERT INTO team_auth_names (team_id, auth, name) VALUES (?,?,?)";
        console.log(
          "Now keys and vals: " +
            Object.keys(auths) +
            " " +
            Object.values(auths)
        );
        for(let key in auths){
          db.query(
          sql,
          [teamID, key, auths[key]],
          function(err, result) {
            if (err) {
              db.rollback(() => {
                console.log(err);
              });
              throw err;
            }
          }
        );
        }
        
      }
    );

    db.commit(err => {
      if (err) {
        db.rollback(() => {
          console.log(err);
        });
        return res.send({ error: "Something failed!" + err });
      }
    });
    return res.json({
      message: "Team created successfully."
    });
    // values.name
    // Opting for KeyValue pairs to insert into the database. Can then do builk insert?
  });
});

//TODO: Finish update statement.
/** PUT - Route serving to update a user admin privilege in the application. Submit through form to update the required data.
 * @name /update
 * @function
 * @memberof module:routes/teams
 * @param {int} req.body[0].id - the Team id stored in the database..
 * @param {string} req.body[0].name - Steam ID of the user being created.
 * @param {string} req.body[0].flag - International Flag code by Steam.
 * @param {string} req.body[0].logo - Integer determining if a user is a super admin of the system. Either 1 or 0.
 * @param {list} req.body[0].auths - An object of type list containing all steam 64 auths on a team.
 * @param {string} req.body[0].tag - A string with a shorthand tag for a team.
 * @param {number} req.body[0].public_team - Integer determining if a team is a publically usable team. Either 1 or 0.
 * @param {list} req.body[0].preferred_names - List containing a 1:1 relation to user auths.
 * @see https://steamcommunity.com/sharedfiles/filedetails/?id=719079703
 */
router.put("/update", function(req, res, next) {
  var columns = [];
  var values = [];
  var team_id = req.body[0].id;
  var queryStr;

  if (typeof req.body[0].name !== "undefined")
    columns.push("name = " + req.body[0].name);

  if (typeof req.body[0].flag !== "undefined")
    columns.push("flag = " + req.body[0].flag);

  if (typeof req.body[0].logo !== "undefined")
    columns.push("logo = " + req.body[0].logo);

  if (typeof req.body[0].tag !== "undefined")
    columns.push("tag = " + req.body[0].tag);

  if (typeof req.body[0].public_team !== "public_team")
    columns.push("public_team = " + req.body[0].public_team);

  var sql = "UPDATE team SET " + columns + " WHERE id=?";
  db.query(sql, [team_id], function(err, result) {
    if (err) {
      res.send({ error: "Something failed!" + err });
    }
    //res.json({ message: "Team edited successfully" });
  });
  // TODO: Check if team was edited, and if anyone was removed or added.
});

//TODO: Various getters/setters are needed to be imported from Get5-Web. Please see https://github.com/PhlexPlexico/get5-web/blob/master/get5/models.py

module.exports = router;
