export interface MatchData {
    match_id?: string,
    user_id?: number,
    server_id?: number,
    team1_id?: number,
    team2_id?: number,
    season_id?: number,
    start_time?: Date | string,
    end_time?: Date | string | null,
    forfeit?: number | null,
    cancelled?: number | null,
    team1_score?: number | null,
    team2_score?: number | null,
    max_maps?: number | null,
    title?: string,
    skip_veto?: number | null | boolean,
    veto_first?: string,
    veto_mappool?: string,
    side_type?: string,
    plugin_version?: string,
    private_match?: number | boolean,
    enforce_teams?: number | boolean,
    api_key?: string,
    winner?: number | null,
    team1_string?: string,
    team2_string?: string,
    is_pug?: boolean,
    min_player_ready?: number,
    players_per_team?: number,
    min_spectators_to_ready?: number,
    map_sides?: string | null,
    wingman?: boolean,
    team1_series_score?: number,
    team2_series_score?: number,
}