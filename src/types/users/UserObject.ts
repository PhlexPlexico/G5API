export interface UserObject { 
    steam_id?: string,
    name?: string,
    admin?: number,
    super_admin?: number,
    small_image?: string,
    medium_image?: string,
    large_image?: string,
    api_key?: string | undefined | null,
    challonge_api_key?: string | undefined | null,
    password?: string | null | undefined,
}