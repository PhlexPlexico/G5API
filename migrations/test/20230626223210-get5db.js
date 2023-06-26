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
    "ALTER TABLE `match` ADD COLUMN wingman tinyint(1) DEFAULT 0 AFTER map_sides;"
  );
};

exports.down = function (db, callback) {
  return db.removeColumn("match", "wingman");
};
exports._meta = {
  version: 25
};
