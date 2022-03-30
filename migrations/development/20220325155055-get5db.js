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
  async.series([
    db.runSql('ALTER TABLE season ADD COLUMN is_challonge boolean AFTER end_date;'),
    db.runSql('ALTER TABLE season ADD COLUMN challonge_svg VARCHAR(256) AFTER is_challonge;'),
    db.runSql('ALTER TABLE season ADD COLUMN challonge_url VARCHAR(256) AFTER challonge_svg;'),
    db.runSql('ALTER TABLE team ADD COLUMN challonge_team_id INT AFTER public_team;'),
    db.addColumn('user', 'challonge_api_key',  { type: 'string', length: 170, unique: true }),
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('season', 'is_challonge'),
    db.removeColumn('season', 'challonge_svg'),
    db.removeColumn('season', 'challonge_url'),
    db.removeColumn('team', 'challonge_team_id'),
    db.removeColumn('user', 'challonge_api_key'),
  ], callback());
};
exports._meta = {
  "version": 19
};