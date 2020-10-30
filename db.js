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
const connPool = mysql.createPool( dbCfg );

class Database {
  constructor() {
    this.setupAdmins();
  }

  async query(sql, args) {
    try {
      const result = await connPool.query(sql, args);
      return result[0];
    } catch (error) {
      console.log(error);
    }
  }
  async buildUpdateStatement(objValues){
    for (let key in objValues) {
      if (objValues[key] == null) delete objValues[key];
    }
    return objValues;
  }

  async getConnection () {
    return await connPool.getConnection();
  }
  /** Inner function - boilerplate transaction call.
  * @name withTransaction
  * @function
  * @inner
  * @memberof module:routes/vetoes
  * @param {*} db - The database object.
  * @param {*} callback - The callback function that is operated on, usually a db.query()
  */
  async withTransaction(callback) {
    const singleConn = await connPool.getConnection();
    await singleConn.beginTransaction();
    try {
      await callback();
      await singleConn.commit();
    } catch (err) {
      await singleConn.rollback();
      console.log(err);
      throw err;
    } finally {
      await singleConn.close();
    } 
  }

  async withNewTransaction(singleCall, callback) {
    await singleCall.beginTransaction();
    try {
      await callback();
      await singleCall.commit();
    } catch (err) {
      await singleCall.rollback();
      throw err;
    } finally {
      await singleCall.release();
    } 
  }

  async setupAdmins() {
    try {
      await this.withTransaction(async () => {
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