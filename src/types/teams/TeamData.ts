export interface TeamData {
    id?: number | string,
    name: string,
    tag: string,
    flag: string,
    logo: string | null,
    matchtext?: string | null | undefined,
    public_team?: number,
    user_id?: number,
    [key: string]: any
}