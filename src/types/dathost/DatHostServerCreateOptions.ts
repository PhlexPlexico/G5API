export interface DatHostServerCreateOptions {
    name: string;
    rcon: string;
    steamGameServerLoginToken: string;
    game?: "cs2" | "csgo";
}