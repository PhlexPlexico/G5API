import { Get5_Player } from "../Get5_Player"

export interface Get5_OnBombDefused {
  event: string
  matchid: string
  map_number: number
  round_number: number
  round_time: number
  player: Get5_Player
  site: string
  bomb_time_remaining: number
}