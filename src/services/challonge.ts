/**
 * Challonge REST API client.
 *
 * Speaks Challonge API v2.1 by default. v2.1 accepts a legacy v1 API key via the
 * `Authorization-Type: v1` header, so the per-user key already stored in
 * `user.challonge_api_key` works unchanged and never has to appear in a URL.
 * Setting `server.challongeApiVersion` to "v1" rolls the whole integration back
 * to the legacy API without a redeploy.
 *
 * @module services/challonge
 */

import fetch, { RequestInit, Response } from "node-fetch";
import config from "config";
import { RowDataPacket } from "mysql2";

import Utils from "../utility/utils.js";
import { db } from "../services/db.js";
import GlobalEmitter from "../utility/emitter.js";

import { ChallongeApiVersion } from "../types/challonge/ChallongeApiVersion.js";
import { ChallongeParticipant } from "../types/challonge/ChallongeParticipant.js";
import { ChallongeMatch } from "../types/challonge/ChallongeMatch.js";
import { ChallongeTournament } from "../types/challonge/ChallongeTournament.js";
import {
  ChallongeV2Resource,
  ChallongeV2Response,
  ChallongeV2MatchAttributes,
  ChallongeV2ParticipantAttributes,
  ChallongeV2TournamentAttributes
} from "../types/challonge/ChallongeV2Response.js";

const V1_BASE_URL = "https://api.challonge.com/v1";
const V2_BASE_URL = "https://api.challonge.com/v2.1";
/** v2.1 pages participants and matches; v1 returns everything at once. */
const V2_PAGE_SIZE = 100;
/** Guards against an unbounded loop if the API ever stops shrinking pages. */
const V2_MAX_PAGES = 100;
const isChallongeVerboseLogsEnabled = process.env.NODE_ENV !== "production";

/** Thrown for any non-2xx Challonge response. Never carries the API key. */
export class ChallongeApiError extends Error {
  constructor(public status: number, public endpoint: string, body: string) {
    super(`Challonge API returned ${status} for ${endpoint}: ${body}`);
    this.name = "ChallongeApiError";
  }
}

/** Reads the configured API version, defaulting to v2.1. */
function getConfiguredApiVersion(): ChallongeApiVersion {
  if (config.has("server.challongeApiVersion")) {
    const configured: string = config.get("server.challongeApiVersion");
    if (configured === "v1" || configured === "v2.1") return configured;
    console.warn(
      `Unknown server.challongeApiVersion "${configured}", falling back to v2.1.`
    );
  }
  return "v2.1";
}

/** Pulls Steam IDs out of a free-form string.
 *
 * Under v2.1 a participant's only custom attribute is `misc`, so organizers pack
 * their roster into it. Accepts comma, semicolon, and newline separators and
 * keeps only well-formed 17-digit IDs, since `team_auth_names.auth` is
 * varchar(17).
 * @param {string | null | undefined} source - The raw value to parse.
 */
export function parseSteamIds(source: string | null | undefined): string[] {
  if (!source) return [];
  const seen: Set<string> = new Set();
  for (const candidate of source.split(/[,;\r\n|]+/)) {
    const trimmed: string = candidate.trim();
    if (/^\d{17}$/.test(trimmed)) seen.add(trimmed);
  }
  return [...seen];
}

/** A Challonge tournament identifier, split into the parts each API needs. */
export interface ChallongeTournamentRef {
  /** The tournament slug or numeric id. */
  id: string;
  /** The community (subdomain) the tournament lives under, if any. */
  communityId: string | null;
}

/** Splits a user-supplied tournament identifier into its parts.
 *
 * Accepts everything an organizer might paste: a bare slug, a numeric id, the
 * v1 `subdomain-slug` form, or a full bracket URL. v2.1 needs the community as
 * a separate `community_id` parameter -- a community tournament 404s without
 * it, even when addressed by numeric id.
 * @param {string} identifier - The raw tournament ID, slug, or URL.
 */
export function parseTournamentRef(identifier: string): ChallongeTournamentRef {
  const raw: string = String(identifier ?? "").trim();

  // A full bracket URL, e.g. https://pleb.challonge.com/testing
  const urlMatch: RegExpMatchArray | null = raw.match(
    /^https?:\/\/(?:([\w-]+)\.)?challonge\.com\/(?:([\w-]+)\/)?([\w-]+)\/?$/i
  );
  if (urlMatch) {
    const [, subdomain, pathCommunity, slug] = urlMatch;
    const community: string | undefined = subdomain && subdomain !== "www" ? subdomain : pathCommunity;
    return { id: slug, communityId: community ?? null };
  }

  return { id: raw, communityId: null };
}

/** Reinterprets a bare identifier as the v1 `subdomain-slug` form.
 *
 * `pleb-testing` may be a community tournament or a slug that simply contains a
 * hyphen; the two are indistinguishable, so this is only ever a candidate to be
 * confirmed against the API, never an assumption.
 * @param {ChallongeTournamentRef} ref - The reference to reinterpret.
 */
function asCommunityCandidate(
  ref: ChallongeTournamentRef
): ChallongeTournamentRef | null {
  if (ref.communityId || /^\d+$/.test(ref.id) || !ref.id.includes("-")) return null;
  const [community, ...rest] = ref.id.split("-");
  return rest.length ? { id: rest.join("-"), communityId: community } : null;
}

export class Challonge {
  /**
   * @param {string} apiKey - The user's decrypted Challonge API key.
   * @param {ChallongeApiVersion} [version] - API version to speak.
   */
  constructor(
    private apiKey: string,
    public readonly version: ChallongeApiVersion = getConfiguredApiVersion()
  ) {
    if (!apiKey) throw new Error("No Challonge API key provided for user.");
  }

  /** Builds a client from a user's stored key.
   * @param {number} userId - The internal user ID.
   */
  static async forUser(userId: number): Promise<Challonge> {
    const rows: RowDataPacket[] = await db.query(
      "SELECT challonge_api_key FROM user WHERE id = ?",
      [userId]
    );
    const apiKey: string | null | undefined = rows[0]
      ? Utils.decrypt(rows[0].challonge_api_key)
      : null;
    if (!apiKey) throw new Error("No challonge API key provided for user.");
    return new Challonge(apiKey);
  }

  /** Fetches a tournament.
   * @param {string} tournamentId - The Challonge tournament ID or URL slug.
   * @param {Object} [opts] - Set `includeParticipants` to also load the roster.
   */
  async getTournament(
    tournamentId: string,
    opts: { includeParticipants?: boolean } = {}
  ): Promise<ChallongeTournament> {
    const ref: ChallongeTournamentRef = await this.resolveRef(tournamentId);
    const segment: string = this.tournamentSegment(ref);
    const community: string = this.communityQuery(ref);
    let tournament: ChallongeTournament;
    if (this.version === "v2.1") {
      const body: ChallongeV2Response<ChallongeV2TournamentAttributes> =
        await this.request(
          `/tournaments/${segment}.json${community ? `?${community}` : ""}`
        );
      const resource = (
        Array.isArray(body.data) ? body.data[0] : body.data
      ) as ChallongeV2Resource<ChallongeV2TournamentAttributes>;
      if (!resource) throw new Error(`Tournament ${tournamentId} not found.`);
      tournament = {
        id: String(resource.id),
        name: resource.attributes.name,
        createdAt: resource.attributes.timestamps?.created_at ?? null,
        liveImageUrl: resource.attributes.live_image_url ?? null
      };
    } else {
      const body: any = await this.request(
        `/tournaments/${segment}.json` +
          (opts.includeParticipants ? "?include_participants=1" : "")
      );
      if (!body?.tournament) throw new Error(`Tournament ${tournamentId} not found.`);
      tournament = {
        id: String(body.tournament.id),
        name: body.tournament.name,
        createdAt: body.tournament.created_at ?? null,
        liveImageUrl: body.tournament.live_image_url ?? null
      };
      if (opts.includeParticipants && body.tournament.participants) {
        tournament.participants = body.tournament.participants.map(
          (entry: any) => this.normalizeV1Participant(entry.participant ?? entry)
        );
      }
    }

    // v2.1 has no include_participants; fetch them separately.
    if (opts.includeParticipants && !tournament.participants) {
      tournament.participants = await this.listParticipants(tournamentId);
    }
    return tournament;
  }

  /** Lists every participant in a tournament, following pagination.
   * @param {string} tournamentId - The Challonge tournament ID or URL slug.
   */
  async listParticipants(tournamentId: string): Promise<ChallongeParticipant[]> {
    const ref: ChallongeTournamentRef = await this.resolveRef(tournamentId);
    const segment: string = this.tournamentSegment(ref);
    let participants: ChallongeParticipant[];

    if (this.version === "v2.1") {
      participants = await this.paginate(
        `/tournaments/${segment}/participants.json`,
        (resource: ChallongeV2Resource<ChallongeV2ParticipantAttributes>) =>
          this.normalizeV2Participant(resource),
        this.communityQuery(ref)
      );
      // v2.1 participants only expose `misc`. Older brackets keep their rosters
      // in v1 custom registration fields, which v2.1 does not surface at all, so
      // fall back to a single v1 call when nothing came through.
      if (participants.length && participants.every((p) => !p.steamIds.length)) {
        await this.mergeV1CustomFields(tournamentId, participants);
      }
    } else {
      const body: any = await this.request(
        `/tournaments/${segment}/participants.json`
      );
      participants = (Array.isArray(body) ? body : []).map((entry: any) =>
        this.normalizeV1Participant(entry.participant ?? entry)
      );
    }
    return participants;
  }

  /** Lists matches, optionally filtered by state and the participants involved.
   * @param {string} tournamentId - The Challonge tournament ID or URL slug.
   * @param {Object} [opts] - `state` filters server-side, `participantIds` locally.
   */
  async listMatches(
    tournamentId: string,
    opts: { state?: string; participantIds?: (string | number)[] } = {}
  ): Promise<ChallongeMatch[]> {
    const ref: ChallongeTournamentRef = await this.resolveRef(tournamentId);
    const segment: string = this.tournamentSegment(ref);
    const stateQuery: string = opts.state
      ? `state=${encodeURIComponent(opts.state)}`
      : "";
    let matches: ChallongeMatch[];

    if (this.version === "v2.1") {
      matches = await this.paginate(
        `/tournaments/${segment}/matches.json`,
        (resource: ChallongeV2Resource<ChallongeV2MatchAttributes>) =>
          this.normalizeV2Match(resource),
        [stateQuery, this.communityQuery(ref)].filter(Boolean).join("&")
      );
    } else {
      const body: any = await this.request(
        `/tournaments/${segment}/matches.json` +
          (stateQuery ? `?${stateQuery}` : "")
      );
      matches = (Array.isArray(body) ? body : []).map((entry: any) =>
        this.normalizeV1Match(entry.match ?? entry)
      );
    }

    if (opts.participantIds?.length) {
      const wanted: Set<string> = new Set(
        opts.participantIds.map((id) => String(id))
      );
      matches = matches.filter(
        (match) =>
          (match.player1Id !== null && wanted.has(match.player1Id)) &&
          (match.player2Id !== null && wanted.has(match.player2Id))
      );
    }
    return matches;
  }

  /** Reports scores for a match.
   *
   * The winner is the side flagged `advancing`; omit it on both sides for a
   * live score-only update.
   * @param {string} tournamentId - The Challonge tournament ID or URL slug.
   * @param {string} matchId - The Challonge match ID.
   * @param {Array} scores - One entry per side, player 1 first.
   */
  async updateMatch(
    tournamentId: string,
    matchId: string,
    scores: { participantId: string; score: number; advancing?: boolean }[]
  ): Promise<void> {
    const ref: ChallongeTournamentRef = await this.resolveRef(tournamentId);
    const segment: string = this.tournamentSegment(ref);
    const community: string = this.communityQuery(ref);
    const encodedMatch: string = encodeURIComponent(matchId);

    if (this.version === "v2.1") {
      await this.request(
        `/tournaments/${segment}/matches/${encodedMatch}.json${
          community ? `?${community}` : ""
        }`,
        {
          method: "PUT",
          body: JSON.stringify({
            data: {
              type: "Match",
              attributes: {
                match: scores.map((entry) => {
                  const side: Record<string, any> = {
                    participant_id: String(entry.participantId),
                    score_set: String(entry.score)
                  };
                  if (entry.advancing !== undefined) side.advancing = entry.advancing;
                  return side;
                })
              }
            }
          })
        }
      );
    } else {
      const winner = scores.find((entry) => entry.advancing);
      const matchBody: Record<string, any> = {
        scores_csv: scores.map((entry) => entry.score).join("-")
      };
      if (winner) matchBody.winner_id = winner.participantId;
      await this.request(
        `/tournaments/${segment}/matches/${encodedMatch}.json`,
        { method: "PUT", body: JSON.stringify({ match: matchBody }) }
      );
    }
  }

  /** Finalizes a tournament, locking in standings.
   * @param {string} tournamentId - The Challonge tournament ID or URL slug.
   */
  async finalizeTournament(tournamentId: string): Promise<void> {
    const ref: ChallongeTournamentRef = await this.resolveRef(tournamentId);
    const segment: string = this.tournamentSegment(ref);
    const community: string = this.communityQuery(ref);
    if (this.version === "v2.1") {
      await this.request(
        `/tournaments/${segment}/change_state.json${community ? `?${community}` : ""}`,
        {
          method: "PUT",
          body: JSON.stringify({
            data: { type: "TournamentState", attributes: { state: "finalize" } }
          })
        }
      );
    } else {
      await this.request(`/tournaments/${segment}/finalize.json`, {
        method: "POST"
      });
    }
  }

  /** Resolved tournament references, keyed by the raw identifier. */
  private refCache: Map<string, ChallongeTournamentRef> = new Map();

  /** Works out how to address a tournament under the active API version.
   *
   * v1 resolves `subdomain-slug` itself, but v2.1 needs the community split out
   * into `community_id` and 404s without it. Since a hyphenated identifier is
   * ambiguous, an ambiguous one is probed once and the answer cached, rather
   * than guessed.
   * @param {string} tournamentId - The raw tournament ID, slug, or URL.
   */
  private async resolveRef(tournamentId: string): Promise<ChallongeTournamentRef> {
    const cached: ChallongeTournamentRef | undefined = this.refCache.get(tournamentId);
    if (cached) return cached;

    const ref: ChallongeTournamentRef = parseTournamentRef(tournamentId);
    const candidate: ChallongeTournamentRef | null =
      this.version === "v2.1" ? asCommunityCandidate(ref) : null;

    let resolved: ChallongeTournamentRef = ref;
    if (candidate) {
      // Prefer the literal reading; only fall back to the community reading if
      // the tournament genuinely is not there under its bare slug.
      try {
        await this.request(`/tournaments/${encodeURIComponent(ref.id)}.json`);
      } catch (err) {
        if (err instanceof ChallongeApiError && err.status === 404) resolved = candidate;
      }
    }
    this.refCache.set(tournamentId, resolved);
    return resolved;
  }

  /** Builds the tournament path segment for the active API version.
   *
   * v1 addresses a community tournament as `subdomain-slug`; v2.1 wants the
   * bare slug plus a `community_id` parameter.
   * @param {ChallongeTournamentRef} ref - The parsed tournament identifier.
   */
  private tournamentSegment(ref: ChallongeTournamentRef): string {
    const path: string =
      this.version === "v1" && ref.communityId
        ? `${ref.communityId}-${ref.id}`
        : ref.id;
    return encodeURIComponent(path);
  }

  /** Builds the `community_id` query parameter v2.1 needs, if any.
   * @param {ChallongeTournamentRef} ref - The parsed tournament identifier.
   */
  private communityQuery(ref: ChallongeTournamentRef): string {
    return this.version === "v2.1" && ref.communityId
      ? `community_id=${encodeURIComponent(ref.communityId)}`
      : "";
  }

  /** Walks every page of a v2.1 collection endpoint.
   * @param {string} path - The endpoint path, without query string.
   * @param {Function} normalize - Maps one raw resource to its normalized form.
   * @param {string} [extraQuery] - Additional query parameters.
   */
  private async paginate<TAttributes, TResult>(
    path: string,
    normalize: (resource: ChallongeV2Resource<TAttributes>) => TResult,
    extraQuery: string = ""
  ): Promise<TResult[]> {
    const results: TResult[] = [];
    for (let page = 1; page <= V2_MAX_PAGES; page++) {
      const query: string = [extraQuery, `page=${page}`, `per_page=${V2_PAGE_SIZE}`]
        .filter(Boolean)
        .join("&");
      const body: ChallongeV2Response<TAttributes> = await this.request(
        `${path}?${query}`
      );
      const resources: ChallongeV2Resource<TAttributes>[] = Array.isArray(body.data)
        ? body.data
        : body.data
        ? [body.data]
        : [];
      results.push(...resources.map(normalize));
      if (resources.length < V2_PAGE_SIZE) break;
    }
    return results;
  }

  /** Issues a request against the configured API version.
   *
   * The key travels in a header rather than the query string, and error
   * messages carry only the path so a key can never reach the logs.
   * @param {string} path - Endpoint path, with query string, relative to the base URL.
   * @param {RequestInit} [init] - Additional fetch options.
   */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const isV2: boolean = this.version === "v2.1";
    const baseUrl: string = isV2 ? V2_BASE_URL : V1_BASE_URL;
    let url: string = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((init.headers as Record<string, string>) ?? {})
    };

    if (isV2) {
      headers["Content-Type"] = "application/vnd.api+json";
      // The seam for OAuth2: swap in "v2" and `Bearer <token>` here.
      headers["Authorization-Type"] = "v1";
      headers["Authorization"] = this.apiKey;
    } else {
      headers["Content-Type"] = "application/json";
      url += `${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(
        this.apiKey
      )}`;
    }

    if (isChallongeVerboseLogsEnabled) {
      console.log(`Challonge ${this.version} ${init.method ?? "GET"} ${path}`);
    }

    const response: Response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const body: string = await response.text().catch(() => "");
      throw new ChallongeApiError(response.status, path, body.substring(0, 500));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Backfills Steam IDs from v1 custom registration fields.
   *
   * v2.1 drops `custom_field_response` entirely, so brackets that predate `misc`
   * would otherwise import teams with no players.
   * @param {string} tournamentId - The Challonge tournament ID or URL slug.
   * @param {ChallongeParticipant[]} participants - Participants to backfill, in place.
   */
  private async mergeV1CustomFields(
    tournamentId: string,
    participants: ChallongeParticipant[]
  ): Promise<void> {
    try {
      const legacy: Challonge = new Challonge(this.apiKey, "v1");
      const v1Participants: ChallongeParticipant[] = await legacy.listParticipants(
        tournamentId
      );
      const byId: Map<string, ChallongeParticipant> = new Map(
        v1Participants.map((participant) => [participant.id, participant])
      );
      for (const participant of participants) {
        const match: ChallongeParticipant | undefined = byId.get(participant.id);
        if (match?.steamIds.length) participant.steamIds = match.steamIds;
      }
    } catch (err) {
      // A missing roster is not fatal; teams still import without players.
      console.warn(
        `Could not read v1 custom fields for tournament ${tournamentId}: ${err}`
      );
    }
  }

  /** Normalizes a v2.1 participant resource.
   * @param {ChallongeV2Resource} resource - The raw JSON:API resource.
   */
  private normalizeV2Participant(
    resource: ChallongeV2Resource<ChallongeV2ParticipantAttributes>
  ): ChallongeParticipant {
    return {
      id: String(resource.id),
      name: resource.attributes?.name ?? "",
      seed: resource.attributes?.seed ?? null,
      steamIds: parseSteamIds(resource.attributes?.misc)
    };
  }

  /** Normalizes a v1 participant object.
   * @param {any} raw - The raw v1 participant.
   */
  private normalizeV1Participant(raw: any): ChallongeParticipant {
    const steamIds: string[] = [];
    const customFields = raw?.custom_field_response;
    if (customFields && typeof customFields === "object") {
      for (const value of Object.values(customFields)) {
        if (typeof value === "string") steamIds.push(...parseSteamIds(value));
      }
    }
    return {
      id: String(raw?.id ?? ""),
      name: raw?.display_name ?? raw?.name ?? "",
      seed: raw?.seed ?? null,
      steamIds: [...new Set(steamIds)]
    };
  }

  /** Normalizes a v2.1 match resource.
   *
   * v2.1 identifies the two sides through `points_by_participant`, falling back
   * to relationships when a side has not been determined yet.
   * @param {ChallongeV2Resource} resource - The raw JSON:API resource.
   */
  private normalizeV2Match(
    resource: ChallongeV2Resource<ChallongeV2MatchAttributes>
  ): ChallongeMatch {
    const attributes: any = resource.attributes ?? {};
    const relationships: any = resource.relationships ?? {};
    const sides: any[] = attributes.points_by_participant ?? [];
    const sideId = (index: number): string | null => {
      const fromPoints = sides[index]?.participant_id;
      if (fromPoints !== undefined && fromPoints !== null) return String(fromPoints);
      const fromRelationship =
        relationships[`player${index + 1}`]?.data?.id ??
        attributes[`player${index + 1}_id`];
      return fromRelationship != null ? String(fromRelationship) : null;
    };
    return {
      id: String(resource.id),
      player1Id: sideId(0),
      player2Id: sideId(1),
      state: attributes.state ?? ""
    };
  }

  /** Normalizes a v1 match object.
   * @param {any} raw - The raw v1 match.
   */
  private normalizeV1Match(raw: any): ChallongeMatch {
    return {
      id: String(raw?.id ?? ""),
      player1Id: raw?.player1_id != null ? String(raw.player1_id) : null,
      player2Id: raw?.player2_id != null ? String(raw.player2_id) : null,
      state: raw?.state ?? ""
    };
  }
}

/** Reports the score of a match in progress back to its Challonge bracket.
 *
 * Finalizes the tournament and closes the season once no open matches remain.
 * @function
 * @memberof module:services/challonge
 * @param {number} match_id - The internal ID of the match being played.
 * @param {number} season_id - The internal ID of the current season of the match being played.
 * @param {number} team1_id - The internal team ID of the first team.
 * @param {number} team2_id - The internal team ID of the second team.
 * @param {number} num_maps - The number of maps in the current match.
 * @param {string} [winner=null] - The string value representing the winner of the match.
 */
export default async function update_challonge_match(
  match_id: number | string | null,
  season_id: number,
  team1_id: number,
  team2_id: number,
  num_maps: number,
  winner: string | null = null
): Promise<void> {
  let sql: string = "SELECT id, challonge_url, user_id FROM season WHERE id = ?";
  const seasonInfo: RowDataPacket[] = await db.query(sql, [season_id]);
  if (!seasonInfo[0]?.challonge_url) return;

  const tournamentId: string = seasonInfo[0].challonge_url;
  sql = "SELECT challonge_team_id FROM team WHERE id = ?";
  const team1ChallongeId: RowDataPacket[] = await db.query(sql, [team1_id]);
  const team2ChallongeId: RowDataPacket[] = await db.query(sql, [team2_id]);
  const team1Participant: string | null = team1ChallongeId[0]?.challonge_team_id
    ? String(team1ChallongeId[0].challonge_team_id)
    : null;
  const team2Participant: string | null = team2ChallongeId[0]?.challonge_team_id
    ? String(team2ChallongeId[0].challonge_team_id)
    : null;
  if (!team1Participant || !team2Participant) return;

  try {
    const challonge: Challonge = await Challonge.forUser(seasonInfo[0].user_id);
    const openMatches: ChallongeMatch[] = await challonge.listMatches(tournamentId, {
      state: "open",
      participantIds: [team1Participant, team2Participant]
    });
    if (!openMatches.length) return;
    const challongeMatch: ChallongeMatch = openMatches[0];

    if (num_maps == 1) {
      // Submit the map stats scores instead.
      sql =
        "SELECT team1_score, team2_score FROM map_stats WHERE match_id = ? ORDER BY map_number DESC LIMIT 1";
    } else {
      sql = "SELECT team1_score, team2_score FROM `match` WHERE id = ?";
    }
    const mapStats: RowDataPacket[] = await db.query(sql, [match_id]);
    if (!mapStats[0]) return;

    // Admins may just make a match that has teams swapped. This is okay as we can
    // change what we report to Challonge.
    const team1Score: number =
      challongeMatch.player1Id == team1Participant
        ? mapStats[0].team1_score
        : mapStats[0].team2_score;
    const team2Score: number =
      challongeMatch.player2Id == team2Participant
        ? mapStats[0].team2_score
        : mapStats[0].team1_score;

    const scores: { participantId: string; score: number; advancing?: boolean }[] = [
      { participantId: challongeMatch.player1Id ?? team1Participant, score: team1Score },
      { participantId: challongeMatch.player2Id ?? team2Participant, score: team2Score }
    ];
    if (winner !== null) {
      const winningParticipant: string =
        winner === "team1" ? team1Participant : team2Participant;
      for (const side of scores) {
        side.advancing = side.participantId === winningParticipant;
      }
    }
    await challonge.updateMatch(tournamentId, challongeMatch.id, scores);

    // Check and see if any matches remain, if not, finalize the tournament.
    const remaining: ChallongeMatch[] = await challonge.listMatches(tournamentId, {
      state: "open"
    });
    if (remaining.length) return;

    await challonge.finalizeTournament(tournamentId);
    // If we are the last map, let's close off the season as well.
    sql = "UPDATE season SET end_date = ? WHERE id = ?";
    await db.query(sql, [
      new Date().toISOString().slice(0, 19).replace("T", " "),
      seasonInfo[0].id
    ]);
    GlobalEmitter.emit("seasonUpdate");
  } catch (err) {
    // Never let a bracket update take down the match flow that triggered it.
    console.error(`Failed to update Challonge match for season ${season_id}: ${err}`);
  }
}

/** Imports Challonge participants as teams, along with their rosters.
 *
 * Skips participants already imported for this user, so the import is safe to
 * re-run against a bracket that has since gained participants.
 * @function
 * @memberof module:services/challonge
 * @param {number} userId - The internal user ID that will own the teams.
 * @param {ChallongeParticipant[]} participants - Participants to import.
 */
export async function importChallongeTeams(
  userId: number,
  participants: ChallongeParticipant[]
): Promise<number> {
  if (!participants.length) return 0;

  const existing: RowDataPacket[] = await db.query(
    "SELECT challonge_team_id FROM team WHERE user_id = ? AND challonge_team_id IN (?)",
    [userId, participants.map((participant) => participant.id)]
  );
  const alreadyImported: Set<string> = new Set(
    existing.map((row) => String(row.challonge_team_id))
  );
  const newParticipants: ChallongeParticipant[] = participants.filter(
    (participant) => !alreadyImported.has(participant.id)
  );
  if (!newParticipants.length) return 0;

  // One insert for the whole bracket, rather than one per participant.
  await db.query("INSERT INTO team (user_id, name, tag, challonge_team_id) VALUES ?", [
    newParticipants.map((participant) => [
      userId,
      participant.name.substring(0, 40),
      participant.name.substring(0, 40),
      participant.id
    ])
  ]);

  // Read the IDs back rather than assuming the auto-increment block is
  // contiguous, then attach each roster to its team.
  const inserted: RowDataPacket[] = await db.query(
    "SELECT id, challonge_team_id FROM team WHERE user_id = ? AND challonge_team_id IN (?)",
    [userId, newParticipants.map((participant) => participant.id)]
  );
  const teamIdByParticipant: Map<string, number> = new Map(
    inserted.map((row) => [String(row.challonge_team_id), row.id])
  );
  for (const participant of newParticipants) {
    const teamId: number | undefined = teamIdByParticipant.get(participant.id);
    if (teamId) await Utils.addChallongeTeamAuthsToArray(teamId, participant.steamIds);
  }
  return newParticipants.length;
}
