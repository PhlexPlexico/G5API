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
    db.runSql('ALTER TABLE user ADD COLUMN password varchar(170) AFTER api_key;'),
    db.runSql('ALTER TABLE user ADD COLUMN username varchar(170) UNIQUE AFTER password;')
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('user', 'password'),
    db.removeColumn('user', 'username')
  ], callback());
};
exports._meta = {
  "version": 18
};
