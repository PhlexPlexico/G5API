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
    .runSql("ALTER TABLE team_auth_names ALTER COLUMN name SET DEFAULT ''")
};

exports.down = function(db) {
  return db
    .runSql("ALTER TABLE team_auth_names MODIFY COLUMN name varchar(40) NULL")
    .then(() => {
      return db.runSql(
        "ALTER TABLE team_auth_names ALTER COLUMN name SET DEFAULT NULL"
      );
    })
    .then(() => {
      return db.runSql(
        "ALTER TABLE team_auth_names MODIFY COLUMN name varchar(40) NOT NULL"
      );
    });
};

exports._meta = {
  "version": 28
};
