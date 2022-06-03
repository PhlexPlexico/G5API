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
  return db.createTable('season_cvar', {
    id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
    season_id: {
      type: 'int', 
      foreignKey: {
        name: 'season_id_season_cvar_fk',
        table: 'season',
        rules: {
          onDelete: 'SET NULL',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      },
      length: 11,
      notNull: false 
    },
    cvar_name: { type: 'string', length: 150 },
    cvar_value: { type: 'string', length: 150 }
  });
};

exports.down = function(db, callback) {
  return db.dropTable('season_cvar');
};

exports._meta = {
  "version": 5
};
