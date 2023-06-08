import { Get5_Winner } from "../Get5_Winner"

export interface Get5_OnSeriesResult {
  event: string
  matchid: string
  team1_series_score: number
  team2_series_score: number
  winner: Get5_Winner
  time_until_restore: number
}