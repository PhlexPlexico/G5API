export interface DatHostServerInfo {
    id: string;
    ip: string;
    ports: { game: number };
    rcon: string;
    status?: string;
    booting?: boolean;
    on?: boolean;
}