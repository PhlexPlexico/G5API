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
    db.addColumn('game_server', 'flag',  { type: 'string', length: 4 })
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('game_server', 'flag')
  ], callback());
};

exports._meta = {
  "version": 6
};