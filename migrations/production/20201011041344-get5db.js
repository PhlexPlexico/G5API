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
    db.addColumn('user', 'api_key',  { type: 'string', length: 170, unique: true }),
    db.addColumn('match', 'is_pug', { type: 'boolean', defaultValue: false })
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('user', 'api_key'),
    db.removeColumn('match', 'is_pug')
  ], callback());
};

exports._meta = {
  "version": 2
};
