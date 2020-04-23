/*Database driver. This should probably be converted to pools.*/
const mysql = require('mysql2/promise');
const config = require('config');
const util = require( 'util' );

const dbCfg = {
  host: config.get("Database.host"),
  port: config.get("Database.port"),
  user: config.get("Database.username"),
  password: config.get("Database.password"),
  database: config.get("Database.db"),
  connectionLimit: config.get("Database.connectionLimit")
}
const connection = mysql.createPool( dbCfg );

class Database {
  constructor() {
    this.setupAdmins();
  }

  async query(sql, args) {
      const result = await connection.query(sql, args);
      return result[0];
  }
  async buildUpdateStatement(objValues){
    for (let key in objValues) {
      if (objValues[key] == null) delete objValues[key];
    }
    return objValues;
  }

  async getConnection () {
    return await connection.getConnection();
  }
  /** Inner function - boilerplate transaction call.
  * @name withTransaction
  * @function
  * @inner
  * @memberof module:routes/vetoes
  * @param {*} db - The database object.
  * @param {*} callback - The callback function that is operated on, usually a db.query()
  */
  async withTransaction(db, callback) {
    const singleConn = await connection.getConnection();
    await singleConn.beginTransaction();
    try {
      await callback();
      await singleConn.commit();
    } catch (err) {
      await singleConn.rollback();
      throw err;
    } finally {
      await singleConn.close();
    } 
  }

  async setupAdmins() {
    try {
      await this.withTransaction(this, async () => {
        let listOfAdmins = config.get("admins.steam_ids").split(',');
        let listofSuperAdmins = config.get("super_admins.steam_ids").split(',');
        // Get list of admins from database and compare list and add new admins.
        let updateAdmins = "UPDATE user SET admin = 1 WHERE steam_id IN (?)";
        let updateSuperAdmins = "UPDATE user SET super_admin = 1 WHERE steam_id in(?)";
        await this.query(updateAdmins, [listOfAdmins]);
        await this.query(updateSuperAdmins, [listofSuperAdmins]);
      });
    } catch (err) {
      console.log("Failed to import users. Error: " + err);
    }
  }
}

module.exports = new Database();