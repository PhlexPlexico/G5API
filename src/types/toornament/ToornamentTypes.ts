/** Credentials of a Toornament application, as stored (decrypted) per user. */
export interface ToornamentCredentials {
    apiKey: string;
    clientId: string;
    clientSecret: string;
}

/** Response of the OAuth2 client_credentials token endpoint. */
export interface ToornamentTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
}

/** A Toornament tournament, as returned by the organizer API. */
export interface ToornamentTournament {
    id: string;
    name: string;
    discipline?: string;
    full_name?: string | null;
    status?: string;
    scheduled_date_start?: string | null;
    logo?: {
        logo_small?: string;
        logo_medium?: string;
        logo_large?: string;
        original?: string;
    } | null;
}

/** A Toornament participant (team or player) of a tournament. */
export interface ToornamentParticipant {
    id: string;
    name: string;
    custom_user_identifier?: string | null;
    custom_fields?: Record<string, any>;
}

export type ToornamentResult = "win" | "loss" | "draw" | null;

/** One side of a Toornament match or match game. */
export interface ToornamentOpponent {
    number: number;
    position?: number;
    result?: ToornamentResult;
    forfeit?: boolean;
    score?: number | null;
    participant?: ToornamentParticipant | null;
}

/** A Toornament match. */
export interface ToornamentMatch {
    id: string;
    tournament_id: string;
    stage_id?: string;
    group_id?: string;
    round_id?: string;
    number?: number;
    type?: string;
    status: "pending" | "running" | "completed";
    scheduled_datetime?: string | null;
    played_at?: string | null;
    opponents: ToornamentOpponent[];
}

/** Format of the matches of a stage or round (e.g. best of 3). */
export interface ToornamentMatchSettings {
    format?: {
        type?: string;
        options?: { nb_match_sets?: number; [key: string]: any };
    } | null;
}

/** A stage (e.g. groups, playoffs) of a Toornament tournament. */
export interface ToornamentStage {
    id: string;
    number: number;
    name: string;
    type?: string;
    match_settings?: ToornamentMatchSettings | null;
}

/** A round of a Toornament stage. */
export interface ToornamentRound {
    id: string;
    stage_id: string;
    group_id?: string;
    number: number;
    name: string;
    match_settings?: ToornamentMatchSettings | null;
}

/** One game (map) of a Toornament match. */
export interface ToornamentGame {
    number: number;
    status: "pending" | "running" | "completed";
    opponents: ToornamentOpponent[];
    properties?: Record<string, any>;
}

/** Body sent when patching the outcome of a match or match game. */
export interface ToornamentOpponentUpdate {
    number: number;
    score?: number | null;
    result?: ToornamentResult;
    forfeit?: boolean;
}
