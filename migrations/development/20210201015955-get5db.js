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
  return db.createTable('map_list', {
    id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
    user_id: {
      type: 'int', 
      foreignKey: {
        name: 'user_id_map_list_fk',
        table: 'user',
        rules: {
          onDelete: 'SET NULL',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      },
      length: 11,
      notNull: false
    },
    map_name: { type: 'string', length: 32, notNull: true, defaultValue: ''},
    map_display_name: { type: 'string', length: 32, notNull: true, defaultValue: ''},
    enabled: { type: 'boolean', defaultValue: true, notNull: true},
    inserted_at: { type: 'datetime', defaultValue: new String('now()'), notNull: true },
  });
};

exports.down = function(db, callback) {
  return db.dropTable('map_list');
};

exports._meta = {
  "version": 14
};