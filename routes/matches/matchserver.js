/** Express API router for users in get5.
 * @module routes/matches
 * @requires express
 * @requires db
 */
const express = require("express");

/** Express module
 * @const
 */

const router = express.Router();
/** Database module.
 * @const
 */

const db = require("../../db");

/** Random string generator for API keys.
 * @const
 */
const randString = require("randomstring");

/** Utility class for various methods used throughout.
 * @const */
const Utils = require("../../utility/utils");

/** RCON Class for use of server integration.
 * @const */
const GameServer = require("../../utility/serverrcon");


module.exports = router;