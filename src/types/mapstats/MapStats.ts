export interface MapStats {
    id?: number,
    match_id?: string,               
    winner?: number | null,
    map_number?: number,
    map_name?: string | null,
    team1_score?: number | null,                 
    team2_score?: number | null,      
    start_time?: Date | string,
    end_time?: Date | string,
    round_restored?: boolean | number,
    demoFile?: string
}