export interface VetoDetails {
    queueId: string;
    mapPool: string[];
    availableMapsToBan: string[];
    bansTeam1: string[]; // Bans by captain1
    bansTeam2: string[]; // Bans by captain2
    captain1SteamId: string;
    captain2SteamId: string;
    vetoInitiatorSteamId: string; // The captain who will ban first (captain2)
    originalOwnerSteamId: string; // Steam ID of the user who originally created the queue
    nextVetoerSteamId: string | null;
    vetoBanOrder: Array<{ captainSteamId: string, bansToMake: number }>;
    currentVetoStageIndex: number;
    bansMadeThisStage: number;
    pickedMap: string | null;
    status: 'not_started' | 'awaiting_captain_start' | 'in_progress' | 'completed' | 'error';
    log: Array<{ timestamp: number, actor: string, action: 'ban' | 'pick' | 'info', map?: string, serverIp?: string, message: string }>;
    serverIp?: string;
}
  