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
  return db.runSql('ALTER TABLE `match` ADD COLUMN toornament_match_id VARCHAR(64) NULL AFTER season_id;')
    .then(() => db.runSql('CREATE INDEX match_toornament_match_id ON `match` (toornament_match_id);'));
};

exports.down = function (db) {
  return db.runSql('DROP INDEX match_toornament_match_id ON `match`;')
    .then(() => db.removeColumn('match', 'toornament_match_id'));
};

exports._meta = {
  version: 31
};