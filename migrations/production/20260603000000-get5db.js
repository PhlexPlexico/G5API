'use strict';

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql("ALTER TABLE user ADD COLUMN theme ENUM('system','light','dark') NOT NULL DEFAULT 'system';");
};

exports.down = function (db) {
  return db.removeColumn('user', 'theme');
};

exports._meta = {
  version: 32
};