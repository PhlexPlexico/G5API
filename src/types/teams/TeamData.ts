export interface TeamData {
    id: number | string,
    name: string,
    tag: string,
    flag: string,
    logo: string,
    matchtext?: string | null | undefined,
    [key: string]: any
}