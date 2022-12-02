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
      "player_stat_id int(11) DEFAULT NULL," +
      "match_id int(11) NOT NULL," +
      "map_id int(11) NOT NULL," +
      "team_id int(11) NOT NULL," +
      "round_number int(11) NOT NULL," +
      "round_time int(11) NOT NULL," +
      "player_attacker_id int(11) DEFAULT NULL," +
      "weapon varchar(15) NOT NULL," +
      "bomb tinyint(1) NOT NULL DEFAULT 0," +
      "headshot tinyint(1) NOT NULL DEFAULT 0," +
      "thru_smoke tinyint(1) NOT NULL DEFAULT 0," +
      "attacker_blind tinyint(1) NOT NULL DEFAULT 0," +
      "no_scope tinyint(1) NOT NULL DEFAULT 0," +
      "suicide tinyint(1) NOT NULL DEFAULT 0," +
      "friendly_fire tinyint(1) NOT NULL DEFAULT 0," +
      "player_assister_id int(11) DEFAULT NULL," +
      "assist_friendly_fire tinyint(1) NOT NULL DEFAULT 0," +
      "flash_assist tinyint(1) NOT NULL DEFAULT 0," +
      "PRIMARY KEY (id)," +
      "KEY player_stat_death_id_extras_fk (player_stat_id)," +
      "KEY player_stat_assister_id_extras_fk (player_assister_id)," +
      "KEY player_stat_attacker_id_extras_fk (player_attacker_id)," +
      "CONSTRAINT match_id_extras_fk FOREIGN KEY (match_id) REFERENCES `match` (id) ON DELETE SET NULL," +
      "CONSTRAINT map_id_extras_fk FOREIGN KEY (map_id) REFERENCES map_stats (id) ON DELETE SET NULL," +
      "CONSTRAINT team_id_extras_fk FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE SET NULL," +
      "CONSTRAINT player_stat_assister_id_extras_fk FOREIGN KEY (player_assister_id) REFERENCES player_stats (id) ON DELETE SET NULL," +
      "CONSTRAINT player_stat_attacker_id_extras_fk FOREIGN KEY (player_attacker_id) REFERENCES player_stats (id) ON DELETE SET NULL," +
      "CONSTRAINT player_stat_death_id_extras_fk FOREIGN KEY (player_stat_id) REFERENCES player_stats (id) ON DELETE SET NULL" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
};

exports.down = function(db) {
  return db.dropTable('player_stat_extras');
};

exports._meta = {
  "version": 22
};

