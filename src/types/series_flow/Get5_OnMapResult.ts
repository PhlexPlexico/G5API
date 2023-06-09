import { Get5_Team } from "../Get5_Team"
import { Get5_Winner } from "../Get5_Winner"

export interface Get5_OnMapResult {
  event: string
  matchid: string
  map_number: number
  team1: Get5_Team
  team2: Get5_Team
  winner: Get5_Winner
}


