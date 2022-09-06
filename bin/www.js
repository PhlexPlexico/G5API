#!/usr/bin/env node

/**
 * Checking for node_env
 */
if(!process.env.NODE_ENV || process.env.NODE_ENV == undefined) {
  console.warn("\x1b[31m%s\x1b[0m", "No NODE_ENV set. Please set NODE_ENV or else default is DEVELOPMENT.");
  process.env.NODE_ENV = 'development';
}
/**
 * Module dependencies.
 */

import app from '../app.js';
import debug from 'debug';
import { createServer } from 'http';
import config from 'config';

/**
 * Get port from environment and store in Express.
 */
var port = normalizePort(config.get("server.port") || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = createServer(app);


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
