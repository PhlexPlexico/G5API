/** A Challonge match, normalized across API versions. */
export interface ChallongeMatch {
    id: string;
    /** Participant ids of the two sides, when they have been determined. */
    player1Id: string | null;
    player2Id: string | null;
    state: string;
}
