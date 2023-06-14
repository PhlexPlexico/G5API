import { Get5_Assist } from "../Get5_Assist"
import { Get5_Attacker } from "../Get5_Attacker"
import { Get5_Player } from "../Get5_Player"
import { Get5_Weapon } from "../Get5_Weapon"

export interface Get5_OnPlayerDeath {
  event: string
  matchid: string
  map_number: number
  round_number: number
  round_time: number
  player: Get5_Player
  weapon: Get5_Weapon
  bomb: boolean
  headshot: boolean
  thru_smoke: boolean
  penetrated: boolean
  attacker_blind: boolean
  no_scope: boolean
  suicide: boolean
  friendly_fire: boolean
  attacker: Get5_Attacker
  assist: Get5_Assist
}
