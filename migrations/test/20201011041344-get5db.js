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
  return db.addColumn('user', 'api_key',  { type: 'string', length: 170, unique: true })
  .then(() => {
    return db.addColumn('match', 'is_pug', { type: 'boolean', defaultValue: false })
  });
};

exports.down = function(db, callback) {
  return db.removeColumn('user', 'api_key')
  .then(() => {
    return db.removeColumn('match', 'is_pug');
  });
};

exports._meta = {
  "version": 2
};
