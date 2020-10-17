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
    db.addColumn('player_stats', 'kast',  { type: 'int', length: 5 }),
    db.addColumn('player_stats', 'contribution_score',  { type: 'int', length: 5 })
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('player_stats', 'kast'),
    db.removeColumn('player_stats', 'contribution_score')
  ], callback());
};

exports._meta = {
  "version": 4
};
