"use strict";

var dbm;
var type;
var seed;
var async = require("async");

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db, callback) {
  return db.runSql(
    "ALTER TABLE `map_stats` ADD COLUMN round_restored tinyint(1) DEFAULT 0 AFTER end_time;"
  );
};

exports.down = function (db, callback) {
  return db.removeColumn("map_stats", "round_restored");
};
exports._meta = {
  version: 24
};
