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
    db.addColumn('player_stats', 'winner',  { type: 'boolean', defaultValue: 0, notNull: true })
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('player_stats', 'winner')
  ], callback());
};

exports._meta = {
  "version": 9
};