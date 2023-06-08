import { Get5_Player } from "../Get5_Player"

export interface Get5_OnPlayerBecameMvp {
  event: string
  matchid: string
  map_number: number
  round_number: number
  player: Get5_Player
  reason: number
}