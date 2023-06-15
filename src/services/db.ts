/*Database driver.*/
import { createPool } from 'mysql2/promise';
import config from 'config';
import { FieldPacket, PoolOptions, RowDataPacket } from 'mysql2/typings/mysql';
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

  async query(sql: string, args?: object) {
    try {
      let result: [RowDataPacket[], FieldPacket[]];
      result = await connPool.query<RowDataPacket[]>(sql, args);
      return result[0];
    } catch (error) {
      console.error("SQL ERROR SQL ERROR SQL ERROR SQL ERROR SQL ERROR\n" + error);
      throw error;
    }
  }
  
  async buildUpdateStatement(objValues: IStringIndex){
    for (let key in objValues) {
      if (objValues[key] == null || objValues[key] == undefined) delete objValues[key];
    }
    return objValues;
  }

  async setupAdmins() {
    try {
      let listOfAdmins = (config.get("admins.steam_ids") as string).split(',');
      let listofSuperAdmins = (config.get("super_admins.steam_ids") as string).split(',');
      // Get list of admins from database and compare list and add new admins.
      let updateAdmins = "UPDATE user SET admin = 1 WHERE steam_id IN (?)";
      let updateSuperAdmins = "UPDATE user SET super_admin = 1 WHERE steam_id in(?)";
      await connPool.query(updateAdmins, [listOfAdmins]);
      await connPool.query(updateSuperAdmins, [listofSuperAdmins]);
    } catch (err) {
      console.error("Failed to import users. " + err);
    }
  }
}
let db = new Database();
export {db};
