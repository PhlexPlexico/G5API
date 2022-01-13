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
    db.runSql('ALTER TABLE `match` ADD COLUMN paused BOOLEAN AFTER min_spectators_to_ready;')
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('match', 'paused'),
  ], callback());
};

exports._meta = {
  "version": 16
};
