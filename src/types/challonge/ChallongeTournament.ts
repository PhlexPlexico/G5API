import { ChallongeParticipant } from "./ChallongeParticipant.js";

/** A Challonge tournament, normalized across API versions. */
export interface ChallongeTournament {
    id: string;
    name: string;
    /** ISO timestamp used as the season start date. */
    createdAt: string | null;
    /** Live-updating bracket image, stored on the season as `challonge_svg`. */
    liveImageUrl: string | null;
    /** Only populated when the tournament was fetched with participants. */
    participants?: ChallongeParticipant[];
}
