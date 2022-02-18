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
    db.createTable('match_pause', {
      id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
      match_id: {
        type: 'int', 
        foreignKey: {
          name: 'match_id_match_pause_fk',
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
      pause_type: { type: 'string', length: 10 },
      team_paused: { type: 'string', length: 40 },
      paused: {type: 'boolean', notNull: false, default: true }
    })
  ], callback());
};

exports.down = function(db, callback) {
  async.series([
    db.dropTable('match_pause')
  ], callback());
};
exports._meta = {
  "version": 17
};
