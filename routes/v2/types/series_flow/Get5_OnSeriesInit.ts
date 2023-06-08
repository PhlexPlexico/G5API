import { Get5_Team } from "../Get5_Team"

export interface Get5_OnSeriesInit {
  event: string
  matchid: string
  num_maps: number
  team1: Get5_Team
  team2: Get5_Team
}