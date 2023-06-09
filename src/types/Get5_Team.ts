import { Get5_Player } from "./Get5_Player"

export interface Get5_Team {
  id: string
  name: string
  series_score: number
  score: number
  score_ct: number
  score_t: number
  players: Get5_Player[]
  side: string
  starting_side: string
}