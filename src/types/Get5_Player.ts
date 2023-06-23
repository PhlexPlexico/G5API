import { Get5_Stats } from "./Get5_Stats"


export interface Get5_Player {
  steamid: string
  name: string
  stats?: Get5_Stats
  user_id?: number,
  side?: string,
  is_bot?: boolean
}