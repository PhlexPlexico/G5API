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
    db.runSql('ALTER TABLE player_stats ADD COLUMN knife_kills int(11) AFTER teamkills;')
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.removeColumn('player_stats', 'util_damage'),
    db.removeColumn('player_stats', 'enemies_flashed'),
    db.removeColumn('player_stats', 'friendlies_flashed'),
    db.removeColumn('player_stats', 'knife_kills')
  ], callback());
};

exports._meta = {
  "version": 13
};