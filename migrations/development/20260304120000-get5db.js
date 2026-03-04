"use strict";

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db, callback) {
  return db.runSql(
    `CREATE TABLE IF NOT EXISTS teams_seasons (
      id INT(11) NOT NULL AUTO_INCREMENT,
      season_id INT(11) NOT NULL,
      teams_id INT(11) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY unique_season_team (season_id, teams_id),
      CONSTRAINT teams_seasons_season_fk FOREIGN KEY (season_id) REFERENCES season (id) ON DELETE CASCADE ON UPDATE RESTRICT,
      CONSTRAINT teams_seasons_team_fk FOREIGN KEY (teams_id) REFERENCES team (id) ON DELETE CASCADE ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
};

exports.down = function (db, callback) {
  return db.runSql("DROP TABLE IF EXISTS teams_seasons;");
};

exports._meta = {
  version: 28,
};
