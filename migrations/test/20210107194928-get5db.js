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
  return db.addColumn('game_server', 'gotv_port',  { type: 'int', defaultValue: null })
  .then(() => {
    return db.createTable('veto_side', {
      id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
      veto_id: {
        type: 'int', 
        foreignKey: {
          name: 'veto_id_veto_side_fk',
          table: 'veto',
          rules: {
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT'
          },
          mapping: 'id'
        },
        length: 11,
        notNull: false 
      },
      match_id: {
        type: 'int', 
        foreignKey: {
          name: 'match_id_veto_side_fk',
          table: 'match',
          rules: {
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT'
          },
          mapping: 'id'
        },
        length: 11,
        notNull: false 
      },
      team_name: { type: 'string', length: 64, notNull: true },
      map: { type: 'string', length: 32, notNull: true },
      side: { type: 'string', length: 10, notNull: true },
    });
  });
};

exports.down = function(db, callback) {
  return db.removeColumn('game_server', 'gotv_port')
  .then(() => {return db.dropTable('veto_side')});
};

exports._meta = {
  "version": 10
};