"use strict";

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.createTable("match_bomb_plants", {
    id: { type: "int", primaryKey: true, autoIncrement: true, length: 11 },
    match_id: {
      type: "int",
      foreignKey: {
        name: "match_id_bomb_plants_fk",
        table: "match",
        rules: {
          onDelete: "CASCADE",
          onUpdate: "RESTRICT"
        },
        mapping: "id"
      },
      length: 11,
      notNull: false
    },
    map_id: {
      type: "int",
      foreignKey: {
        name: "map_id_bomb_plants_fk",
        table: "map_stats",
        rules: {
          onDelete: "CASCADE",
          onUpdate: "RESTRICT"
        },
        mapping: "id"
      },
      length: 11,
      notNull: false
    },
    player_stats_id: {
      type: "int",
      foreignKey: {
        name: "player_stats_id_bomb_plants_fk",
        table: "player_stats",
        rules: {
          onDelete: "CASCADE",
          onUpdate: "RESTRICT"
        },
        mapping: "id"
      },
      length: 11,
      notNull: false
    },
    round_number: { type: "int", length: 11, notNull: true },
    round_time: { type: "int", length: 11, notNull: true },
    site: { type: "string", length: 10, notNull: true },
    defused: { type: "boolean", notNull: false },
    bomb_time_remaining: { type: "int", length: 11, notNull: false }
  });
};

exports.down = function (db) {
  return db.dropTable("match_bomb_plants");
};

exports._meta = {
  version: 23
};
