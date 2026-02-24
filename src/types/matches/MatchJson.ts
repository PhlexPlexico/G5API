export interface MatchJSON {
    matchid: number | string,
    match_title: string,
    side_type: string,
    veto_first: string,
    skip_veto: boolean,
    min_players_to_ready: number
    players_per_team: number,
    team1: {},
    team2: {},
    cvars: {
        get5_web_api_url?: string,
        get5_check_auths?: string,
        get5_remote_log_url?: string,
        get5_remote_log_header_key?: string,
        get5_remote_log_header_value?: string,
        get5_remote_backup_url?: string,
        get5_remote_backup_header_key?: string,
        get5_remote_backup_header_value?: string,
        get5_demo_upload_url?: string,
        get5_demo_upload_header_key?: string,
        get5_demo_upload_header_value?: string,
        [key: string]: any
    },
    spectators: {
        players: {[key: string]: any}
    },
    maplist?: string | null
    min_spectators_to_ready: number,
    wingman: boolean,
    num_maps?: number,
    map_sides?: string,
}