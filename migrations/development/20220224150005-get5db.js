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
  return db.runSql('ALTER TABLE user ADD COLUMN password varchar(170) AFTER api_key;')
    .then(() => {return db.runSql('ALTER TABLE user ADD COLUMN username varchar(170) UNIQUE AFTER password;');});
};

exports.down = function(db, callback) {
  return db.removeColumn('user', 'password')
    .then(() => {return db.removeColumn('user', 'username');});
};
exports._meta = {
  "version": 18
};
