export interface GameServerObject {
    user_id?: number,
    in_use?: number,
    ip_string?: string,
    port?: number,
    rcon_password?: string | null,
    display_name?: string,
    public_server?: number,
    flag?: string,
    gotv_port?: number
}