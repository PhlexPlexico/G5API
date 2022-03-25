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
    db.runSql('ALTER TABLE season ADD COLUMN is_challonge boolean AFTER end_date;'),
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('season', 'is_challonge'),
  ], callback());
};
exports._meta = {
  "version": 19
};