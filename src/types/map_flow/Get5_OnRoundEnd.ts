import { Get5_Team } from "../Get5_Team"
import { Get5_Winner } from "../Get5_Winner"

export interface Get5_OnRoundEnd {
  event: string
  matchid: string
  map_number: number
  round_number: number
  round_time: number
  reason: number
  winner: Get5_Winner
  team1: Get5_Team
  team2: Get5_Team
}