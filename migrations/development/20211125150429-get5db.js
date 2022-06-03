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
  return db.runSql('ALTER TABLE player_stats ADD COLUMN team_name varchar(64) AFTER mvp;');
};

exports.down = function(db, callback) {
  return db.removeColumn('player_stats', 'team_name');
};

exports._meta = {
  "version": 15
};
