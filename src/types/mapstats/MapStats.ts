export interface MapStats {
    id?: number,
    match_id?: string,               
    winner?: number
    map_number?: number,
    map_name?: string,
    team1_score?: number,                 
    team2_score?: number,      
    start_time?: Date
    end_time?: Date,
    round_restored?: boolean | number,
    demoFile?: string
}