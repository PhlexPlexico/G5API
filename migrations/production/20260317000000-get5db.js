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
  return db
    .runSql(
      "CREATE TABLE IF NOT EXISTS dathost_config (" +
        "id INT NOT NULL AUTO_INCREMENT, " +
        "email VARCHAR(512) NOT NULL, " +
        "password VARCHAR(512) NOT NULL, " +
        "steam_game_server_login_token VARCHAR(512) NOT NULL DEFAULT '', " +
        "shutdown_delay_seconds INT NOT NULL DEFAULT 0, " +
        "preferred_location VARCHAR(64) NOT NULL DEFAULT '', " +
        "PRIMARY KEY (id)" +
        ")"
    )
    .then(function () {
      return db.runSql(
        "ALTER TABLE dathost_config " +
          "ADD COLUMN user_id INT NULL, " +
          "ADD UNIQUE INDEX uq_dathost_config_user_id (user_id)"
      );
    });
};

exports.down = function (db) {
  return db.runSql(
    "ALTER TABLE dathost_config " +
      "DROP INDEX uq_dathost_config_user_id, " +
      "DROP COLUMN user_id"
  );
};

exports._meta = {
  version: 29
};
