/** A Challonge participant, normalized across API versions.
 *
 * The raw v1 and v2.1 payloads differ (`display_name` vs `attributes.name`,
 * `custom_field_response` vs `misc`), so routes and services only ever see this
 * shape.
 */
export interface ChallongeParticipant {
    /** Challonge's participant id. A string in v2.1, a number in v1. */
    id: string;
    name: string;
    seed?: number | null;
    /** Steam IDs pulled from `misc` (v2.1) or `custom_field_response` (v1). */
    steamIds: string[];
}
