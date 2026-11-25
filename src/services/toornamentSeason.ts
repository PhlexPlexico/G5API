/**
 * Toornament view of a season: lists the bracket matches split by state and
 * prepares G5 matches from them.
 *
 * @module services/toornamentSeason
 */

import { RowDataPacket } from "mysql2";

import { db } from "./db.js";
import { Toornament, importToornamentTeams } from "./toornament.js";
import {
  ToornamentGame,
  ToornamentMatch,
  ToornamentMatchSettings,
  ToornamentRound,
  ToornamentStage
} from "../types/toornament/ToornamentTypes.js";

/** Thrown with an HTTP status the route should answer with. */
export class SeasonBoardError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SeasonBoardError";
  }
}

export interface BoardOpponent {
  number: number;
  participant_id: string | null;
  name: string | null;
  score: number | null;
  result: string | null;
  forfeit: boolean;
  team_id: number | null;
}

export interface BoardMatch {
  id: string;
  number: number | null;
  status: string;
  stage: string | null;
  stage_number: number | null;
  round: string | null;
  max_maps: number;
  scheduled_datetime: string | null;
  played_at: string | null;
  opponents: BoardOpponent[];
  g5_match: {
    id: number;
    team1_id: number;
    team2_id: number;
    team1_score: number | null;
    team2_score: number | null;
    start_time: string | null;
    end_time: string | null;
  } | null;
}

export interface SeasonBoard {
  old: BoardMatch[];
  current: BoardMatch[];
  to_launch: BoardMatch[];
}

/** Board results are cached briefly, as building one costs several API calls. */
const BOARD_CACHE_MS = 20 * 1000;
const boardCache: Map<number, { at: number; board: SeasonBoard }> = new Map();

export function invalidateSeasonBoard(seasonId: number): void {
  boardCache.delete(seasonId);
}

interface ToornamentSeason {
  id: number;
  user_id: number;
  toornament_id: string;
}

async function getToornamentSeason(seasonId: number): Promise<ToornamentSeason> {
  const rows: RowDataPacket[] = await db.query(
    "SELECT id, user_id, toornament_id, is_toornament FROM season WHERE id = ?",
    [seasonId]
  );
  if (!rows[0]) throw new SeasonBoardError(404, "Season not found.");
  if (!rows[0].is_toornament || !rows[0].toornament_id)
    throw new SeasonBoardError(400, "This season was not imported from Toornament.");
  return rows[0] as ToornamentSeason;
}

/** Number of games of a match, from the round format or else the stage format. */
function bestOf(...settings: (ToornamentMatchSettings | null | undefined)[]): number {
  for (const setting of settings) {
    const format = setting?.format;
    if (!format?.type) continue;
    if (format.type === "single") return 1;
    const sets: number | undefined = format.options?.nb_match_sets;
    if (sets && sets > 0) return sets;
  }
  return 1;
}

/** Maps Toornament participant IDs to the G5 teams imported for them. */
async function getTeamsByParticipant(ownerId: number): Promise<Map<string, number>> {
  // Prefer the season owner's teams, then any team linked to the participant.
  const rows: RowDataPacket[] = await db.query(
    "SELECT id, toornament_team_id, user_id FROM team WHERE toornament_team_id IS NOT NULL ORDER BY (user_id = ?) ASC, id ASC",
    [ownerId]
  );
  const map: Map<string, number> = new Map();
  for (const row of rows) map.set(String(row.toornament_team_id), row.id);
  return map;
}

/** Builds the Old / Current / To launch lists of a Toornament season.
 * @param {number} seasonId - The internal season ID.
 */
export async function getSeasonBoard(seasonId: number): Promise<SeasonBoard> {
  const cached = boardCache.get(seasonId);
  if (cached && Date.now() - cached.at < BOARD_CACHE_MS) return cached.board;

  const season: ToornamentSeason = await getToornamentSeason(seasonId);
  const toornament: Toornament = await Toornament.forUser(season.user_id);
  const [matches, stages, rounds] = await Promise.all([
    toornament.listMatches(season.toornament_id),
    toornament.listStages(season.toornament_id),
    toornament.listRounds(season.toornament_id)
  ]);
  const stageById: Map<string, ToornamentStage> = new Map(stages.map((s) => [s.id, s]));
  const roundById: Map<string, ToornamentRound> = new Map(rounds.map((r) => [r.id, r]));
  const teamByParticipant: Map<string, number> = await getTeamsByParticipant(season.user_id);

  const g5Rows: RowDataPacket[] = await db.query(
    "SELECT id, toornament_match_id, team1_id, team2_id, team1_score, team2_score, start_time, end_time " +
      "FROM `match` WHERE season_id = ? AND toornament_match_id IS NOT NULL " +
      "AND (cancelled IS NULL OR cancelled = 0) ORDER BY id ASC",
    [seasonId]
  );
  const g5ByToornament: Map<string, RowDataPacket> = new Map();
  for (const row of g5Rows) g5ByToornament.set(String(row.toornament_match_id), row);

  const board: SeasonBoard = { old: [], current: [], to_launch: [] };
  for (const match of matches) {
    const stage = match.stage_id ? stageById.get(match.stage_id) : undefined;
    const round = match.round_id ? roundById.get(match.round_id) : undefined;
    const g5 = g5ByToornament.get(match.id);
    const opponents: BoardOpponent[] = (match.opponents ?? []).map((opp) => {
      const participantId: string | null = opp.participant?.id ? String(opp.participant.id) : null;
      return {
        number: opp.number,
        participant_id: participantId,
        name: opp.participant?.name ?? null,
        score: opp.score ?? null,
        result: opp.result ?? null,
        forfeit: Boolean(opp.forfeit),
        team_id: participantId ? teamByParticipant.get(participantId) ?? null : null
      };
    });
    const item: BoardMatch = {
      id: match.id,
      number: match.number ?? null,
      status: match.status,
      stage: stage?.name ?? null,
      stage_number: stage?.number ?? null,
      round: round?.name ?? null,
      max_maps: bestOf(round?.match_settings, stage?.match_settings),
      scheduled_datetime: match.scheduled_datetime ?? null,
      played_at: match.played_at ?? null,
      opponents,
      g5_match: g5
        ? {
            id: g5.id,
            team1_id: g5.team1_id,
            team2_id: g5.team2_id,
            team1_score: g5.team1_score,
            team2_score: g5.team2_score,
            start_time: g5.start_time,
            end_time: g5.end_time
          }
        : null
    };

    const g5Live: boolean = Boolean(g5 && !g5.end_time);
    if (g5Live || (match.status === "running" && !g5)) board.current.push(item);
    else if (match.status === "completed" || g5) board.old.push(item);
    else if (match.status === "running") board.current.push(item);
    else if (opponents.length >= 2 && opponents.every((opp) => opp.participant_id))
      board.to_launch.push(item);
  }

  const byStructure = (a: BoardMatch, b: BoardMatch) =>
    (a.stage_number ?? 0) - (b.stage_number ?? 0) || (a.number ?? 0) - (b.number ?? 0);
  board.to_launch.sort(byStructure);
  board.current.sort(byStructure);
  board.old.sort(
    (a, b) => new Date(b.played_at ?? 0).getTime() - new Date(a.played_at ?? 0).getTime()
  );

  boardCache.set(seasonId, { at: Date.now(), board });
  return board;
}

/** Lists the games (maps and scores) of a match of the season.
 * @param {number} seasonId - The internal season ID.
 * @param {string} toornamentMatchId - The Toornament match ID.
 */
export async function getSeasonMatchGames(
  seasonId: number,
  toornamentMatchId: string
): Promise<ToornamentGame[]> {
  const season: ToornamentSeason = await getToornamentSeason(seasonId);
  const toornament: Toornament = await Toornament.forUser(season.user_id);
  const match: ToornamentMatch = await toornament.getMatch(toornamentMatchId);
  if (String(match.tournament_id) !== String(season.toornament_id))
    throw new SeasonBoardError(404, "Match does not belong to this season.");
  return toornament.listGames(toornamentMatchId);
}

/** Builds the body of `POST /matches` for a Toornament match, ready to be sent
 * with a server ID. Teams missing for a participant are created on the fly.
 * @param {number} seasonId - The internal season ID.
 * @param {string} toornamentMatchId - The Toornament match ID.
 * @param {number} userId - The user preparing the match.
 */
export async function prepareSeasonMatch(
  seasonId: number,
  toornamentMatchId: string,
  userId: number
): Promise<Record<string, any>> {
  const season: ToornamentSeason = await getToornamentSeason(seasonId);
  await assertNoActiveG5Match(toornamentMatchId);

  const toornament: Toornament = await Toornament.forUser(season.user_id);
  const match: ToornamentMatch = await toornament.getMatch(toornamentMatchId);
  if (String(match.tournament_id) !== String(season.toornament_id))
    throw new SeasonBoardError(404, "Match does not belong to this season.");
  if (match.status === "completed")
    throw new SeasonBoardError(409, "This match is already completed on Toornament.");
  const opponents = [...(match.opponents ?? [])].sort((a, b) => a.number - b.number);
  if (opponents.length < 2 || !opponents[0].participant || !opponents[1].participant)
    throw new SeasonBoardError(409, "Both opponents of this match are not known yet.");

  await importToornamentTeams(
    season.user_id,
    opponents.slice(0, 2).map((opp) => opp.participant!)
  );
  const teamByParticipant: Map<string, number> = await getTeamsByParticipant(season.user_id);
  const team1Id = teamByParticipant.get(String(opponents[0].participant!.id));
  const team2Id = teamByParticipant.get(String(opponents[1].participant!.id));
  if (!team1Id || !team2Id) throw new SeasonBoardError(500, "Could not resolve the teams.");

  const [stages, rounds] = await Promise.all([
    toornament.listStages(season.toornament_id),
    toornament.listRounds(season.toornament_id)
  ]);
  const stage = stages.find((s) => s.id === match.stage_id);
  const round = rounds.find((r) => r.id === match.round_id);
  const maxMaps: number = bestOf(round?.match_settings, stage?.match_settings);

  const cvarRows: RowDataPacket[] = await db.query(
    "SELECT cvar_name, cvar_value FROM season_cvar WHERE season_id = ?",
    [seasonId]
  );
  const cvars: Record<string, string> = {};
  for (const row of cvarRows) cvars[row.cvar_name] = row.cvar_value;
  const take = (name: string): string | undefined => {
    const value = cvars[name];
    delete cvars[name];
    return value === undefined || value === null || value === "" ? undefined : String(value);
  };

  let mapPool: string | undefined = take("map_pool")?.trim();
  if (!mapPool) {
    const maps: RowDataPacket[] = await db.query(
      "SELECT map_name FROM map_list WHERE user_id = ? AND enabled = 1 ORDER BY id",
      [userId]
    );
    mapPool = maps.map((m) => m.map_name).join(" ");
  }
  const toInt = (value: string | undefined, fallback: number): number =>
    value !== undefined && !isNaN(parseInt(value)) ? parseInt(value) : fallback;
  const toBool = (value: string | undefined): boolean =>
    value !== undefined && value !== "0" && value !== "false";

  const titleParts: string[] = [stage?.name, round?.name].filter(Boolean) as string[];
  if (match.number) titleParts.push(`Match ${match.number}`);
  // The season's own maps_to_win is ignored: the bracket format is authoritative.
  take("maps_to_win");
  const spectators: string | undefined = take("spectators");
  const mapSides: string | undefined = take("map_sides");

  return {
    server_id: null,
    team1_id: team1Id,
    team2_id: team2Id,
    team1_name: opponents[0].participant!.name,
    team2_name: opponents[1].participant!.name,
    season_id: seasonId,
    toornament_match_id: match.id,
    title: titleParts.join(" - ") || "Toornament match",
    max_maps: maxMaps,
    veto_mappool: mapPool,
    side_type: take("side_type") ?? "standard",
    skip_veto: toBool(take("skip_veto")),
    wingman: toBool(take("wingman")),
    min_players_to_ready: toInt(take("min_players_to_ready"), 5),
    players_per_team: toInt(take("players_per_team"), 5),
    min_spectators_to_ready: toInt(take("min_spectators_to_ready"), 0),
    spectator_auths: spectators ? spectators.trim().split(" ") : null,
    map_sides: mapSides ? mapSides.trim().split(" ").join(",") : null,
    veto_first: "team1",
    match_cvars: cvars,
    game: "cs2"
  };
}

/** Refuses to link a Toornament match that already has a live or finished G5 match.
 * @param {string} toornamentMatchId - The Toornament match ID.
 */
export async function assertNoActiveG5Match(toornamentMatchId: string): Promise<void> {
  const rows: RowDataPacket[] = await db.query(
    "SELECT id FROM `match` WHERE toornament_match_id = ? AND (cancelled IS NULL OR cancelled = 0) LIMIT 1",
    [toornamentMatchId]
  );
  if (rows[0])
    throw new SeasonBoardError(
      409,
      `A match (#${rows[0].id}) already exists for this Toornament match.`
    );
}
