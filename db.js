var mysql = require('mysql');
var config = require('config');

var connection = mysql.createConnection({
  socketPath: config.get("Database.sockFile"),
  user: config.get("Database.username"),
  password: config.get("Database.password"),
  database: config.get("Database.db")
});

connection.connect(function(err) {
  if (err) throw err;
  console.log('connected!');
});

module.exports = connection;