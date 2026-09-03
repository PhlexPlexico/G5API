/** A single JSON:API resource object as returned by Challonge API v2.1. */
export interface ChallongeV2Resource<T = Record<string, any>> {
    id: string;
    type: string;
    attributes: T;
    relationships?: Record<string, any>;
}

/** The JSON:API envelope wrapping every v2.1 response body. */
export interface ChallongeV2Response<T = Record<string, any>> {
    data: ChallongeV2Resource<T> | ChallongeV2Resource<T>[];
    meta?: Record<string, any>;
    links?: Record<string, any>;
}

/** Participant attributes as returned by v2.1. */
export interface ChallongeV2ParticipantAttributes {
    name: string;
    seed?: number | null;
    group_id?: number | null;
    tournament_id?: number;
    username?: string | null;
    final_rank?: number | null;
    states?: Record<string, boolean>;
    /** Free-form string; the only place a v2.1 participant can carry Steam IDs. */
    misc?: string | null;
    timestamps?: { created_at?: string; updated_at?: string };
}

/** Tournament attributes as returned by v2.1. */
export interface ChallongeV2TournamentAttributes {
    name: string;
    url?: string;
    tournament_type?: string;
    state?: string;
    live_image_url?: string | null;
    timestamps?: { created_at?: string; updated_at?: string };
}

/** Match attributes as returned by v2.1. */
export interface ChallongeV2MatchAttributes {
    state: string;
    round?: number;
    identifier?: string;
    winner_id?: string | number | null;
    /** Per-side scoring; the winner is the entry flagged `advancing`. */
    points_by_participant?: {
        participant_id: string | number;
        scores: (string | number)[];
    }[];
    timestamps?: { created_at?: string; updated_at?: string };
}
