const mysql = require('mysql');
const config = require('config');
const util = require( 'util' );

const dbCfg = {
  socketPath: config.get("Database.sockFile"),
  user: config.get("Database.username"),
  password: config.get("Database.password"),
  database: config.get("Database.db")
}

function makeDb( config ) {
  const connection = mysql.createConnection( config );  return {
    query( sql, args ) {
      return util.promisify( connection.query )
        .call( connection, sql, args );
    },
    close() {
      return util.promisify( connection.end ).call( connection );
    },
    beginTransaction() {
      return util.promisify( connection.beginTransaction )
        .call( connection );
    },
    commit() {
      return util.promisify( connection.commit )
        .call( connection );
    },
    rollback() {
      return util.promisify( connection.rollback )
        .call( connection );
    },
    async buildUpdateStatement(objValues){
      for (let key in objValues) {
        if (objValues[key] === null) delete objValues[key];
      }
      return objValues;
    }
  };
}



const conn = makeDb( dbCfg );

module.exports = conn;