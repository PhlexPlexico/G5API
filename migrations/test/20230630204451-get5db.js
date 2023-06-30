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
  return db.addColumn("match_bomb_plants", "bomb_time_remaining", {
    type: "int",
    length: 10,
    notNull: true,
    defaultValue: 0
  });
};

exports.down = function (db, callback) {
  return db.removeColumn("match_bomb_plants", "bomb_time_remaining");
};
exports._meta = {
  version: 27
};
