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

exports.up = async function(db, callback) {
  return db.createTable('user', {
    id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
    steam_id: { type: 'string', length: 17, notNull: true, unique: true},
    name: { type: 'string', length: 40 },
    admin: { type: 'boolean', defaultValue: false, notNull: true},
    super_admin: { type: 'boolean', defaultValue: false, notNull: true },
    created_at: { type: 'datetime', defaultValue: new String('now()'), notNull: true },
    small_image: { type: 'string', length: 150 },
    medium_image: { type: 'string', length: 150 },
    large_image: { type: 'string', length: 150 }
  }).then(
    () => {
      return db.createTable('game_server', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
        user_id: {
          type: 'int', 
          foreignKey: {
            name: 'user_id_game_server_fk',
            table: 'user',
            rules: {
              onDelete: 'CASCADE',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11 
        },
        in_use: { type: 'boolean', defaultValue: false, notNull: true },
        ip_string: { type: 'string', length: 32 },
        port: { type: 'int', length: 11 },
        rcon_password: { type: 'string', length: 128 },
        display_name: { type: 'string', length: 32 },
        public_server: { type: 'boolean', defaultValue: false, notNull: true }
      });
    }
  ).then(
    () => {
      return db.createTable('team', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
        user_id: {
          type: 'int', 
          foreignKey: {
            name: 'user_id_team_fk',
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
        name: { type: 'string', length: 40 },
        flag: { type: 'string', length: 4 },
        logo: { type: 'string', length: 10 },
        tag: { type: 'string', length: 40 },
        public_team: { type: 'boolean', defaultValue: false, notNull: true },
      });
    }
  ).then(
    () => {
      return db.createTable('team_auth_names', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
        team_id: {
          type: 'int', 
          foreignKey: {
            name: 'team_id_team_auth_names_fk',
            table: 'team',
            rules: {
              onDelete: 'CASCADE',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          }
        },
        auth: { type: 'string', length: 17, notNull: true },
        name: { type: 'string', length: 40, notNull: true, default: '' },
      });
    }
  ).then(
    () => {
      return db.createTable('season', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11 },
        user_id: {
          type: 'int', 
          foreignKey: {
            name: 'user_id_season_fk',
            table: 'user',
            rules: {
              onDelete: 'CASCADE',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11 
        },
        name: { type: 'string', length: 40 },
        start_date: 'datetime',
        end_date: 'datetime'
      });
    }
  ).then(
    () => {
      return db.createTable('match', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11, notNull: true },
        user_id: {
          type: 'int', 
          foreignKey: {
            name: 'user_id_match_fk',
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
        server_id: {
          type: 'int', 
          foreignKey: {
            name: 'game_server_id_match_fk',
            table: 'game_server',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        team1_id: {
          type: 'int', 
          foreignKey: {
            name: 'team_id_match_team1_fk',
            table: 'team',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        team2_id: {
          type: 'int', 
          foreignKey: {
            name: 'team_id_match_team2_fk',
            table: 'team',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        winner: {
          type: 'int', 
          foreignKey: {
            name: 'team_id_match_winner_fk',
            table: 'team',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false,
        },
        team1_score: { type: 'int', defaultValue: 0, notNull: true, length: 11 },
        team2_score: { type: 'int', defaultValue: 0, notNull: true, length: 11 },
        team1_series_score: { type: 'int', notNull: false, length: 11 },
        team2_series_score: { type: 'int', notNull: false, length: 11 },
        team1_string: { type: 'string', notNull: false, length: 32 },
        team2_string: { type: 'string', notNull: false, length: 32 },
        cancelled: { type: 'boolean', defaultValue: false, notNull: true },
        forfeit: { type: 'boolean', defaultValue: false, notNull: true },
        start_time: 'datetime',
        end_time: 'datetime',
        max_maps: { type: 'int', length: 11, notNull: true },
        title: { type: 'string', length: 60, defaultValue: 'Map {MAPNUMBER} of {MAXMAPS}' },
        skip_veto: { type: 'boolean', defaultValue: false, notNull: true },
        api_key: { type: 'string', length: 32, notNull: true },
        veto_mappool: { type: 'string', length: 500 },
        veto_first: { type: 'string', length: 5 },
        side_type: { type: 'string', length: 32 },
        plugin_version: { type: 'string', length: 32, defaultValue: 'unknown', notNull: false},
        private_match: { type: 'boolean', defaultValue: false, notNull: true },
        enforce_teams: { type: 'boolean', defaultValue: false, notNull: true },
        min_player_ready: {type: 'int', defaultValue: 5, notNull: true},
        season_id: {
          type: 'int', 
          foreignKey: {
            name: 'season_id_match_fk',
            table: 'season',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        }
      });
    }
  ).then(
    () => {
      return db.createTable('match_spectator', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11, notNull: true },
        match_id: {
          type: 'int', 
          foreignKey: {
            name: 'match_id_match_spectator_fk',
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
        auth: { type: 'string', length: 17, notNull: true }
      });
    }
  ).then(
    () => {
      return db.createTable('map_stats', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11, notNull: true },
        match_id: {
          type: 'int', 
          foreignKey: {
            name: 'match_id_map_stats_fk',
            table: 'match',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        winner: {
          type: 'int', 
          foreignKey: {
            name: 'team_id_map_stats_winner_fk',
            table: 'team',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        map_number: { type: 'int', notNull: true, length: 11, defaultValue: 0 },
        map_name: { type: 'string', length: 64 },
        team1_score: { type: 'int', notNull: true, length: 11, defaultValue: 0 },
        team2_score: { type: 'int', notNull: true, length: 11, defaultValue: 0 },
        start_time: { type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP', notNull: true },
        end_time: 'datetime',
        demoFile: { type: 'string', length: 256 }
      });
    }
  ).then(
    () => {
      return db.createTable('match_audit', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11, notNull: true },
        match_id: {
          type: 'int', 
          foreignKey: {
            name: 'match_id_match_audit_fk',
            table: 'match',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        user_id: {
          type: 'int', 
          foreignKey: {
            name: 'user_id_match_audit_fk',
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
        time_affected: { type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP', notNull: true },
        cmd_used: { type: 'string', length: 4000 }
      });
    }
  ).then(
    () => {
      return db.createTable('veto', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11, notNull: true },
        match_id: {
          type: 'int', 
          foreignKey: {
            name: 'match_id_veto_fk',
            table: 'match',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        team_name: { type: 'string', length: 64, notNull: true },
        map: { type: 'string', length: 32, notNull: true },
        pick_or_veto: { type: 'string', length: 4, notNull: true }
      });
    }
  ).then(
    () => {
      return db.createTable('player_stats', {
        id: { type: 'int', primaryKey: true, autoIncrement: true, length: 11, notNull: true },
        match_id: {
          type: 'int', 
          foreignKey: {
            name: 'match_id_player_stats_fk',
            table: 'match',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        map_id: {
          type: 'int', 
          foreignKey: {
            name: 'map_stats_id_player_stats_fk',
            table: 'map_stats',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        team_id: {
          type: 'int', 
          foreignKey: {
            name: 'team_id_player_stats_fk',
            table: 'team',
            rules: {
              onDelete: 'SET NULL',
              onUpdate: 'RESTRICT'
            },
            mapping: 'id'
          },
          length: 11,
          notNull: false 
        },
        steam_id: { type: 'string', length: 17, notNull: true },
        name: { type: 'string', length: 40 },
        kills: { type: 'int', length: 11 },
        headshot_kills: { type: 'int', length: 11 },
        deaths: { type: 'int', length: 11 },
        assists: { type: 'int', length: 11 },
        flashbang_assists: { type: 'int', length: 11 },
        roundsplayed: { type: 'int', length: 11 },
        teamkills: { type: 'int', length: 11 },
        suicides: { type: 'int', length: 11 },
        damage: { type: 'int', length: 11 },
        bomb_plants: { type: 'int', length: 11 },
        bomb_defuses: { type: 'int', length: 11 },
        v1: { type: 'int', length: 11 },
        v2: { type: 'int', length: 11 },
        v3: { type: 'int', length: 11 },
        v4: { type: 'int', length: 11 },
        v5: { type: 'int', length: 11 },
        k1: { type: 'int', length: 11 },
        k2: { type: 'int', length: 11 },
        k3: { type: 'int', length: 11 },
        k4: { type: 'int', length: 11 },
        k5: { type: 'int', length: 11 },
        firstdeath_ct: { type: 'int', length: 11 },
        firstdeath_t: { type: 'int', length: 11 },
        firstkill_ct: { type: 'int', length: 11 },
        firstkill_t: { type: 'int', length: 11 }
      });
    }
  );
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
