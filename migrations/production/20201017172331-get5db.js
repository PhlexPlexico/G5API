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
  return db.addColumn('player_stats', 'kast',  { type: 'int', length: 5 })
  .then(() => {
    return db.addColumn('player_stats', 'contribution_score',  { type: 'int', length: 5 });
  });

};

exports.down = function(db, callback) {
  return db.removeColumn('player_stats', 'kast')
  .then(() => {
    return db.removeColumn('player_stats', 'contribution_score');
  });
};

exports._meta = {
  "version": 4
};
