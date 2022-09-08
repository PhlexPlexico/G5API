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
  return db.addColumn('match', 'map_sides',  { type: 'string', length: 75, notNull: false });
};

exports.down = function(db, callback) {
  return db.removeColumn('match', 'map_sides');
};
exports._meta = {
  "version": 21
};