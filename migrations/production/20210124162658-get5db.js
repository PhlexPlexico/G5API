'use strict';

var dbm;
var type;
var seed;
var async = require('async');

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db, callback) {
  async.series([
    db.runSql('ALTER TABLE player_stats ADD COLUMN util_damage int(11) AFTER damage;'),
    db.runSql('ALTER TABLE player_stats ADD COLUMN enemies_flashed int(11) AFTER util_damage;'),
    db.runSql('ALTER TABLE player_stats ADD COLUMN friendlies_flashed int(11) AFTER enemies_flashed;'),
    db.runSql('ALTER TABLE player_stats ADD COLUMN knife_kills int(11) AFTER teamkills;'),
    db.changeColumn('player_stats', 'name', { type: 'string', length: 40, defaultValue: '', notNull: true}),
    db.changeColumn('player_stats', 'kills', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'headshot_kills', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'deaths', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'assists', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'flashbang_assists', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'roundsplayed', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'teamkills', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'knife_kills', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'suicides', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'damage', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'util_damage', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'enemies_flashed', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'friendlies_flashed', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'bomb_plants', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'bomb_defuses', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'v1', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'v2', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'v3', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'v4', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'v5', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'k1', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'k2', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'k3', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'k4', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'k5', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'firstdeath_ct', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'firstdeath_t', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'firstkill_ct', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'firstkill_t', { type: 'int', length: 11, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'kast', { type: 'int', length: 5, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'contribution_score', { type: 'int', length: 5, defaultValue: 0, notNull: true}),
    db.changeColumn('player_stats', 'mvp', { type: 'int', length: 11, defaultValue: 0, notNull: true})

  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('player_stats', 'util_damage'),
    db.removeColumn('player_stats', 'enemies_flashed'),
    db.removeColumn('player_stats', 'friendlies_flashed'),
    db.removeColumn('player_stats', 'knife_kills'),
    db.changeColumn('player_stats', 'name', { type: 'string', length: 40}),
    db.changeColumn('player_stats', 'kills', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'headshot_kills', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'deaths', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'assists', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'flashbang_assists', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'roundsplayed', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'teamkills', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'suicides', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'damage', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'bomb_plants', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'bomb_defuses', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'v1', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'v2', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'v3', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'v4', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'v5', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'k1', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'k2', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'k3', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'k4', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'k5', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'firstdeath_ct', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'firstdeath_t', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'firstkill_ct', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'firstkill_t', { type: 'int', length: 11}),
    db.changeColumn('player_stats', 'kast', { type: 'int', length: 5}),
    db.changeColumn('player_stats', 'contribution_score', { type: 'int', length: 5}),
    db.changeColumn('player_stats', 'mvp', { type: 'int', length: 11})
  ], callback());
};

exports._meta = {
  "version": 13
};
