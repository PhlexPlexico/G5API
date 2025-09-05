export interface SteamApiResponse {
    response: {
        success: boolean
        up_to_date: boolean
        version_is_listable: boolean
        required_version?: number
        message?: string
    }
}
