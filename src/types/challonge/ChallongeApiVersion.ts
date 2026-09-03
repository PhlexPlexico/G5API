/** Which Challonge API the client should speak.
 *
 * v2.1 is the current API and is what new integrations should use. It accepts a
 * legacy v1 API key through the `Authorization-Type: v1` header, so no OAuth2
 * onboarding is required. "v1" remains available as a rollback path.
 */
export type ChallongeApiVersion = "v1" | "v2.1";
