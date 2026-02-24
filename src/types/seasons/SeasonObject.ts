export interface SeasonObject {
    id?: number;
    user_id?: number;
    name?: string | null;
    start_date?: Date | null;
    end_date?: Date | null;
    is_challonge?: boolean | null;
    challonge_svg?: string | null;
    challonge_url?: string | null;

}