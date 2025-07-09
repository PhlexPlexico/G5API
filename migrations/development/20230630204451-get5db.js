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
    "ALTER TABLE match_bomb_plants MODIFY COLUMN bomb_time_remaining int(10) NOT NULL DEFAULT 0;"
  );
};

exports.down = function (db, callback) {
  return db.runSql(
    "ALTER TABLE match_bomb_plants MODIFY COLUMN bomb_time_remaining int(10) NOT NULL DEFAULT 0;"
  );
};
exports._meta = {
  version: 27,
};
