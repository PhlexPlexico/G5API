"use strict";

var dbm;
var type;
var seed;

/**
 * Add dathost_server_id and is_managed to game_server;
 * add dathost_allowed to user for DatHost on-the-fly provisioning.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db
    .addColumn("game_server", "dathost_server_id", {
      type: "string",
      length: 64,
      notNull: false
    })
    .then(function () {
      return db.addColumn("game_server", "is_managed", {
        type: "boolean",
        notNull: true,
        defaultValue: false
      });
    })
    .then(function () {
      return db.addColumn("user", "dathost_allowed", {
        type: "boolean",
        notNull: true,
        defaultValue: false
      });
    });
};

exports.down = function (db) {
  return db
    .removeColumn("user", "dathost_allowed")
    .then(function () {
      return db.removeColumn("game_server", "is_managed");
    })
    .then(function () {
      return db.removeColumn("game_server", "dathost_server_id");
    });
};

exports._meta = {
  version: 28
};
