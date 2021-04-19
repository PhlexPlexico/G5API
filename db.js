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
    const connection = await this.getConnection();
    try {
      let result;
      await this.withNewTransaction(connection, async () => {
        result = await connection.query(sql, args);
      });
      return result[0];
    } catch (error) {
      console.log("SQL ERROR SQL ERROR SQL ERROR SQL ERROR SQL ERROR\n" + error);
      connection.destroy();
      throw error;
    } finally {
      connection.release();
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
  * @name withNewTransaction
  * @function
  * @inner
  * @memberof module:routes/vetoes
  * @param {*} singleCall - The connection from the database pool.
  * @param {*} callback - The callback function that is operated on, usually a db.query()
  */
  async withNewTransaction(singleCall, callback) {
    await singleCall.beginTransaction();
    let isDestroyed = false;
    try {
      await callback();
      await singleCall.commit();
    } catch (err) {
      await singleCall.rollback();
      isDestroyed = true;
      throw err;
    } finally {
      if (isDestroyed) await singleCall.destroy();
      else await singleCall.release();
    } 
  }

  async setupAdmins() {
    try {
      let singleConn = await this.getConnection();
      await this.withNewTransaction(singleConn, async () => {
        let listOfAdmins = config.get("admins.steam_ids").split(',');
        let listofSuperAdmins = config.get("super_admins.steam_ids").split(',');
        // Get list of admins from database and compare list and add new admins.
        let updateAdmins = "UPDATE user SET admin = 1 WHERE steam_id IN (?)";
        let updateSuperAdmins = "UPDATE user SET super_admin = 1 WHERE steam_id in(?)";
        await singleConn.query(updateAdmins, [listOfAdmins]);
        await singleConn.query(updateSuperAdmins, [listofSuperAdmins]);
      });
    } catch (err) {
      console.log("Failed to import users. Error: " + err);
    }
  }
}

module.exports = new Database();
