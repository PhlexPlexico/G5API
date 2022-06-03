'use strict';

var dbm;
var type;
var seed;
var async = require('async');

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db, callback) {
  return db.runSql('ALTER TABLE season ADD COLUMN is_challonge boolean AFTER end_date;')
    .then(() => {return db.runSql('ALTER TABLE season ADD COLUMN challonge_svg VARCHAR(256) AFTER is_challonge;');})
    .then(() => {return db.runSql('ALTER TABLE season ADD COLUMN challonge_url VARCHAR(256) AFTER challonge_svg;');})
    .then(() => {return db.runSql('ALTER TABLE team ADD COLUMN challonge_team_id INT AFTER public_team;');})
    .then(() => {return db.addColumn('user', 'challonge_api_key',  { type: 'string', length: 170, unique: true });});
};

exports.down = function(db, callback) {
  return db.removeColumn('season', 'is_challonge')
    .then(() => {return db.removeColumn('season', 'challonge_svg');})
    .then(() => {return db.removeColumn('season', 'challonge_url');})
    .then(() => {return db.removeColumn('team', 'challonge_team_id');})
    .then(() => {return db.removeColumn('user', 'challonge_api_key');});
};
exports._meta = {
  "version": 19
};