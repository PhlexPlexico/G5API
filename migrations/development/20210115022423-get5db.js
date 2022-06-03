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
  return db.addColumn('player_stats', 'mvp',  { type: 'int', defaultValue: null });
};

exports.down = function(db, callback) {
  return db.removeColumn('player_stats', 'mvp');
};

exports._meta = {
  "version": 11
};