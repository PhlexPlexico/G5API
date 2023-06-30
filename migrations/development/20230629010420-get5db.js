'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db
    .runSql("ALTER TABLE player_stats ALTER COLUMN knife_kills SET DEFAULT 0")
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN damage SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN util_damage SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN enemies_flashed SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN friendlies_flashed SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN bomb_plants SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN bomb_defuses SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v1 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v2 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v3 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v4 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v5 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k1 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k2 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k3 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k4 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k5 SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstdeath_ct SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstdeath_t SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstkill_ct SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstkill_t SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN kast SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN contribution_score SET DEFAULT 0"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN mvp SET DEFAULT 0"
      );
    });
};

exports.down = function(db) {
  return db
    .runSql("ALTER TABLE player_stats ALTER COLUMN knife_kills SET DEFAULT NULL")
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN damage SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN util_damage SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN enemies_flashed SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN friendlies_flashed SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN bomb_plants SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN bomb_defuses SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v1 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v2 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v3 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v4 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN v5 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k1 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k2 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k3 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k4 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN k5 SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstdeath_ct SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstdeath_t SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstkill_ct SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN firstkill_t SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN kast SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN contribution_score SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE player_stats ALTER COLUMN mvp SET DEFAULT NULL"
      );
    });
};

exports._meta = {
  "version": 1
};
