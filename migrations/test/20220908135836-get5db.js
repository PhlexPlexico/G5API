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
  return db.runSql("CREATE TABLE player_stat_extras (" +
      "id int(11) NOT NULL AUTO_INCREMENT," +
      "player_steam_id varchar(17) NOT NULL," +
      "player_name varchar(75) NOT NULL," +
      "player_side varchar(5) NOT NULL," +
      "map_id int(11)," +
      "match_id int(11)," +
      "team_id int(11)," +
      "round_number int(11) NOT NULL," +
      "round_time int(11) NOT NULL," +
      "attacker_steam_id int(11) DEFAULT NULL," +
      "attacker_name varchar(75) DEFAULT NULL," +
      "attacker_side varchar(5) DEFAULT NULL," +
      "weapon varchar(15) NOT NULL," +
      "bomb tinyint(1) NOT NULL DEFAULT 0," +
      "headshot tinyint(1) NOT NULL DEFAULT 0," +
      "thru_smoke tinyint(1) NOT NULL DEFAULT 0," +
      "attacker_blind tinyint(1) NOT NULL DEFAULT 0," +
      "no_scope tinyint(1) NOT NULL DEFAULT 0," +
      "suicide tinyint(1) NOT NULL DEFAULT 0," +
      "friendly_fire tinyint(1) NOT NULL DEFAULT 0," +
      "assister_steam_id int(11) DEFAULT NULL," +
      "assister_name varchar(75) DEFAULT NULL," +
      "assister_side varchar(5) DEFAULT NULL," +
      "assist_friendly_fire tinyint(1) NOT NULL DEFAULT 0," +
      "flash_assist tinyint(1) NOT NULL DEFAULT 0," +
      "PRIMARY KEY (id)," +
      "KEY map_id_extras_fk (map_id)," +
      "KEY match_id_extras_fk (match_id)," +
      "KEY team_id_extras_fk (team_id)," +
      "CONSTRAINT map_id_extras_fk FOREIGN KEY (map_id) REFERENCES map_stats (id) ON DELETE SET NULL," +
      "CONSTRAINT match_id_extras_fk FOREIGN KEY (match_id) REFERENCES `match` (id) ON DELETE SET NULL," +
      "CONSTRAINT team_id_extras_fk FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE SET NULL," +
      "INDEX player_steam_id_idx(player_steam_id)," +
      "INDEX attacker_steam_id_idx(attacker_steam_id)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
};

exports.down = function(db) {
  return db.dropTable('player_stat_extras');
};

exports._meta = {
  "version": 22
};

