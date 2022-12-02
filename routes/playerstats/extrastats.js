/**
 * @swagger
 * resourcePath: /playerstats/extras
 * description: Express API for player additional stats in Get5 matches.
 */
 import { Router } from "express";
 import app from "../../app.js";
 
 const router = Router();
 
 import db from "../../db.js";
 
 import Utils from "../../utility/utils.js";
 
 import GlobalEmitter from "../../utility/emitter.js";

 /* Swagger shared definitions */
/**
 * @swagger
 *
 * components:
 *   schemas:
 *     PlayerStats:
 *       type: object
 *       required:
 *         - match_id
 *         - map_id
 *         - team_id
 *         - steam_id
 *         - name
 *       properties:
 *         player_stat_id:
 *           type: integer
 *           description: Integer determining which player had died in the system, the victim.
 *         match_id:
 *           type: integer
 *           description: Match identifier in the system.
 *         map_id:
 *           type: integer
 *           description: Integer determining the current map of the match.
 *         team_id:
 *           type: integer
 *           description: Integer determining the team a player is on.
 *         round_number:
 *           type: integer
 *           description: Integer determining the round that the player death occurred on.
 *        round_time:
 *           type: integer
 *           description: Integer determining the round time that the player death occurred on.
 *        player_attacker_id:
 *           type: integer
 *           description: Player identifier in the system on the given team that had killed the player that this record represents.
 *        weapon:
 *           type: string
 *           description: The name of the weapon that the player died from.
 *        bomb:
 *           type: boolean
 *           description: Whether the player died from the bomb or not.
 *        headshot:
 *           type: boolean
 *           description: Whether the player died from a headshot.
 *        thru_smoke:
 *           type: boolean
 *           description: Whether the player died thru smoke.
 *        attacker_blind:
 *           type: boolean
 *           description: Whether the player was killed by a blind attacker.
 *        no_scope:
 *           type: boolean
 *           description: Whether the player was killed by a no scope.
 *        suicide:
 *           type: boolean
 *           description: Whether the player had killed themselves via suicide.
 *        friendly_fire:
 *           type: boolean
 *           description: Whether the player had died from friendly fire.
 *        player_assister_id:
 *           type: integer
 *           description: Player identifier in the system on the given team.
 *        assist_friendly_fire:
 *           type: boolean
 *           description: Indicates if the assist was friendly fire.
 *        flash_assist:
 *           type: boolean
 *           description: Indicates if the assist was via a flashbang.
 */