/*Database driver. This should probably be converted to pools.*/
const mysql = require('mysql2/promise');
const config = require('config');

const dbCfg = {
  host: config.get(process.env.NODE_ENV+".host"),
  port: config.get(process.env.NODE_ENV+".port"),
  user: config.get(process.env.NODE_ENV+".user"),
  password: config.get(process.env.NODE_ENV+".password"),
  database: config.get(process.env.NODE_ENV+".database"),
  connectionLimit: config.get(process.env.NODE_ENV+".connectionLimit")
}
const connPool = mysql.createPool(dbCfg);

class Database {
  constructor() {
    this.setupAdmins();
  }

  async query(sql, args) {
    try {
      let result;
      result = await connPool.query(sql, args);
      return result[0];
    } catch (error) {
      console.log("SQL ERROR SQL ERROR SQL ERROR SQL ERROR SQL ERROR\n" + error);
      throw error;
    }
  }

  async buildUpdateStatement(objValues){
    for (let key in objValues) {
      if (objValues[key] == null) delete objValues[key];
    }
    return objValues;
  }

  async setupAdmins() {
    try {
      let listOfAdmins = config.get("admins.steam_ids").split(',');
      let listofSuperAdmins = config.get("super_admins.steam_ids").split(',');
      // Get list of admins from database and compare list and add new admins.
      let updateAdmins = "UPDATE user SET admin = 1 WHERE steam_id IN (?)";
      let updateSuperAdmins = "UPDATE user SET super_admin = 1 WHERE steam_id in(?)";
      await connPool.query(updateAdmins, [listOfAdmins]);
      await connPool.query(updateSuperAdmins, [listofSuperAdmins]);
    } catch (err) {
      console.log("Failed to import users. " + err);
    }
  }
}

module.exports = new Database();
