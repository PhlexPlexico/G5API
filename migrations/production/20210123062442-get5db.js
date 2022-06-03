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
  return db.addColumn('match', 'min_spectators_to_ready',  { type: 'int', defaultValue: 0 });
};

exports.down = function(db, callback) {
  return db.removeColumn('match', 'min_spectators_to_ready');
};

exports._meta = {
  "version": 12
};