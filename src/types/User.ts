export interface User {
  steam_id: string
  name: string
  admin: boolean | number
  super_admin: boolean | number
  id: number
  small_image: string
  medium_image: string
  large_image: string
  api_key: string
}