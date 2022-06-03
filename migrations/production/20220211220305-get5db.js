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
    return db.runSql('ALTER TABLE match_spectator ADD COLUMN spectator_name varchar(40) AFTER auth;');
};

exports.down = function(db, callback) {
    return db.removeColumn('match_spectator', 'spectator_name');
};
exports._meta = {
  "version": 16
};
