'use strict';

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql('ALTER TABLE user ADD COLUMN toornament_api_key VARCHAR(512) NULL AFTER challonge_api_key;')
    .then(() => db.runSql('ALTER TABLE user ADD COLUMN toornament_client_id VARCHAR(512) NULL AFTER toornament_api_key;'))
    .then(() => db.runSql('ALTER TABLE user ADD COLUMN toornament_client_secret VARCHAR(512) NULL AFTER toornament_client_id;'))
    .then(() => db.runSql('ALTER TABLE season ADD COLUMN is_toornament BOOLEAN NOT NULL DEFAULT 0 AFTER challonge_url;'))
    .then(() => db.runSql('ALTER TABLE season ADD COLUMN toornament_id VARCHAR(64) NULL AFTER is_toornament;'))
    .then(() => db.runSql('ALTER TABLE season ADD COLUMN toornament_logo VARCHAR(512) NULL AFTER toornament_id;'))
    .then(() => db.runSql('ALTER TABLE team ADD COLUMN toornament_team_id VARCHAR(64) NULL AFTER challonge_team_id;'));
};

exports.down = function (db) {
  return db.removeColumn('team', 'toornament_team_id')
    .then(() => db.removeColumn('season', 'toornament_logo'))
    .then(() => db.removeColumn('season', 'toornament_id'))
    .then(() => db.removeColumn('season', 'is_toornament'))
    .then(() => db.removeColumn('user', 'toornament_client_secret'))
    .then(() => db.removeColumn('user', 'toornament_client_id'))
    .then(() => db.removeColumn('user', 'toornament_api_key'));
};

exports._meta = {
  version: 30
};