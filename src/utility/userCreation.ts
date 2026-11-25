/* Shared user creation logic, used by the admin UI route and the startup bootstrap. */
import { hashSync } from "bcrypt";
import { generate } from "randomstring";
import { db } from "../services/db.js";
import Utils from "./utils.js";

export type Role = "user" | "admin" | "super_admin";

export const ROLES: { [key in Role]: { admin: number; super_admin: number } } = {
  user: { admin: 0, super_admin: 0 },
  admin: { admin: 1, super_admin: 0 },
  super_admin: { admin: 0, super_admin: 1 },
};

export interface NewUserOptions {
  steamId: string;
  role: Role;
  name?: string | null;
  username?: string | null;
  password?: string | null;
}

export class UserCreationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Resolves any steam identifier (steam64, STEAM_x, profile URL...) to a steam64, or "" if invalid. */
export async function resolveSteam64(input: string): Promise<string> {
  const value = (input ?? "").toString().trim();
  if (/^\d{17}$/.test(value)) return value;
  // Bare vanity names would silently resolve to a random Steam profile: only accept explicit formats.
  if (!/^(STEAM_|\[?U:1:|1:[01]:|(https?:\/\/)?steamcommunity\.com\/(id|profiles)\/)/i.test(value)) return "";
  try {
    const resolved = await Utils.getSteamPID(value);
    return resolved ? resolved.toString() : "";
  } catch {
    return "";
  }
}

/** Inserts a user. Throws UserCreationError(409) if the steam ID or username is already taken. */
export async function createUser(opts: NewUserOptions): Promise<number> {
  const existing = await db.query(
    "SELECT id FROM user WHERE steam_id = ? OR (username IS NOT NULL AND username = ?)",
    [opts.steamId, opts.username ?? ""]
  );
  if (existing.length > 0) {
    throw new UserCreationError(409, "Username or SteamID already exists.");
  }
  const steamName = opts.name || (await Utils.getSteamName(opts.steamId)) || opts.steamId;
  const smallImage = await Utils.getSteamImage(opts.steamId);
  const newUser: { [key: string]: any } = {
    steam_id: opts.steamId,
    name: steamName,
    ...ROLES[opts.role],
    created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    api_key: Utils.encrypt(generate({ length: 64, capitalization: "uppercase" })),
  };
  if (smallImage) {
    newUser.small_image = smallImage;
    newUser.medium_image = smallImage;
    newUser.large_image = smallImage;
  }
  if (opts.username && opts.password) {
    newUser.username = opts.username;
    newUser.password = hashSync(opts.password, 10);
  }
  const result: any = await db.query("INSERT INTO user SET ?", [newUser]);
  return result.insertId;
}
