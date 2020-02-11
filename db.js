/*Database driver. This should probably be converted to pools.*/
const mysql = require('mysql2/promise');
const config = require('config');
const util = require( 'util' );

const dbCfg = {
  socketPath: config.get("Database.sockFile"),
  user: config.get("Database.username"),
  password: config.get("Database.password"),
  database: config.get("Database.db"),
  connectionLimit: config.get("Database.connectionLimit")
}
const connection = mysql.createPool( dbCfg );

class Database {
  async query(sql, args) {
      const result = await connection.query(sql, args);
      return result[0];
  }
  async buildUpdateStatement(objValues){
    for (let key in objValues) {
      if (objValues[key] === null) delete objValues[key];
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
}

module.exports = new Database();