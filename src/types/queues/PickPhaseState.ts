export interface PickPhaseState {
    captain1: string;
    team1Name: string;
    team1Picks: string[];
    captain2: string;
    team2Name: string;
    team2Picks: string[];
    availablePlayers: string[];
    nextPicker: string;
    picksMade: number;
    capacity: number;
    totalPlayersToPick: number;
    status: string;
    serverIp?: string | null;
}
  