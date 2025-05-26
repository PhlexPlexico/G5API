export interface PickPhaseDetails {
    all_players: string; // JSON string array
    available_players: string; // JSON string array
    captain1: string;
    captain2: string;
    team1_name: string;
    team2_name: string;
    team1_picks: string; // JSON string array
    team2_picks: string; // JSON string array
    next_picker: string;
    original_queue_id: string;
    original_owner_steam_id?: string;
    capacity: string;
    picks_made: string;
    server_ip?: string;
}
  