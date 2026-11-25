/*Database driver.*/
import { createPool } from 'mysql2/promise';
import config from 'config';
import { FieldPacket, PoolOptions, QueryValues, RowDataPacket } from 'mysql2/typings/mysql';
interface IStringIndex {
  [key: string]: any;
}
const dbCfg = {
  host: config.get(process.env.NODE_ENV+".host"),
  port: config.get(process.env.NODE_ENV+".port"),
  user: config.get(process.env.NODE_ENV+".user"),
  password: config.get(process.env.NODE_ENV+".password"),
  database: config.get(process.env.NODE_ENV+".database"),
  connectionLimit: config.get(process.env.NODE_ENV+".connectionLimit")
} as PoolOptions;
const connPool = createPool(dbCfg);

class Database {
  constructor() {
    this.setupAdmins();
  }

  async query(sql: string, args?: object): Promise<RowDataPacket[]> {
    try {
      let result: [RowDataPacket[], FieldPacket[]];
      result = await connPool.query<RowDataPacket[]>(sql, args as QueryValues);
      return result[0];
    } catch (error) {
      console.error("SQL ERROR SQL ERROR SQL ERROR SQL ERROR SQL ERROR\n" + error);
      throw error;
    }
  }
  
  async buildUpdateStatement(objValues: IStringIndex): Promise<IStringIndex> {
    for (let key in objValues) {
      if (objValues[key] == null || objValues[key] == undefined) delete objValues[key];
    }
    return objValues;
  }

  async hasSuperAdmin(): Promise<boolean> {
    const rows = await this.query("SELECT 1 FROM user WHERE super_admin = 1 LIMIT 1");
    return rows.length > 0;
  }

  async setupAdmins(): Promise<void> {
    try {
      // The config lists only seed the database: missing users are inserted, existing users keep
      // the role managed from the UI. Only when no super admin exists are listed users promoted.
      const { createUser, resolveSteam64 } = await import("../utility/userCreation.js");
      const parse = (key: string) =>
        (config.get(key) as string).split(",").map((s) => s.trim()).filter((s) => /^\d{17}$/.test(s));
      const listOfAdmins = parse("admins.steam_ids");
      const listOfSuperAdmins = parse("super_admins.steam_ids");
      const seeds: Array<[string, "admin" | "super_admin"]> = [
        ...listOfSuperAdmins.map((id) => [id, "super_admin"] as [string, "super_admin"]),
        ...listOfAdmins.map((id) => [id, "admin"] as [string, "admin"]),
      ];
      for (const [steamId, role] of seeds) {
        const exists = await this.query("SELECT id FROM user WHERE steam_id = ?", [steamId] as any);
        if (exists.length === 0) {
          await createUser({ steamId: await resolveSteam64(steamId), role });
        }
      }
      if (!(await this.hasSuperAdmin()) && listOfSuperAdmins.length > 0) {
        await connPool.query("UPDATE user SET admin = 0, super_admin = 1 WHERE steam_id IN (?)", [listOfSuperAdmins]);
      }
      if (!(await this.hasSuperAdmin()) && listOfAdmins.length > 0) {
        await connPool.query("UPDATE user SET admin = 1 WHERE steam_id IN (?) AND super_admin = 0", [listOfAdmins]);
      }
    } catch (err) {
      console.error("Failed to import users. " + err);
    }
  }
}
let db = new Database();
export {db};
