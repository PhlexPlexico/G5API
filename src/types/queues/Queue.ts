export interface Queue {
    id: string;
    ownerSteamId: string;
    capacity: number;
    createdAt: number;
    status: 'waiting' | 'popped' | 'picking' | 'in_progress' | 'completed' | 'error_popping' | 'error_not_enough_players_for_captains' | 'in_progress_server_assigned' | 'pending_server_manual' | 'error_server_allocation_failed';
    members: string[];
    server_ip?: string;
    picked_map?: string; // Optional: The map that was picked in the veto
}
