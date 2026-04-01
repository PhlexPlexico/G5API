"use strict";

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(
    "ALTER TABLE `match` ADD COLUMN game ENUM('cs2','csgo') NOT NULL DEFAULT 'cs2' AFTER wingman;"
  );
};

exports.down = function (db) {
  return db.removeColumn("match", "game");
};

exports._meta = {
  version: 29
};
