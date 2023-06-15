import { db } from "./db.js";

/** ZIP files.
 * @const
 */
import JSZip from "jszip";

/** Required to save files.
 * @const
 */
import { existsSync, mkdirSync, writeFile } from "fs";

/** Config to check demo uploads.
 * @const
 */
import config from "config";

/**
 * @const
 * Global Server Sent Emitter class for real time data.
 */
import GlobalEmitter from "../utility/emitter.js";

import Utils from "../utility/utils.js";
import { Get5_OnGoingLive } from "../types/map_flow/Get5_OnGoingLive.js";
import { Response } from "express";
import { RowDataPacket } from "mysql2";
import { Get5_OnMatchPausedUnpaused } from "../types/map_flow/Get5_OnMatchPausedUnpaused.js";
import { Get5_OnPlayerDeath } from "../types/map_flow/Get5_OnPlayerDeath.js";
import { Get5_OnBombEvent } from "../types/map_flow/Get5_OnBombEvent.js";

class MapFlowService {
  static async OnGoingLive(
    apiKey: string,
    event: Get5_OnGoingLive,
    res: Response
  ) {
    try {
      const matchApiCheck: number = await Utils.checkApiKey(
        apiKey,
        event.matchid
      );
      // XXX: Figure out where to store version number, be it at match start or when calling get5_status when creating the match.
      let sqlString: string;
      let mapStatInfo: RowDataPacket[];
      let vetoInfo: RowDataPacket[];
      let startTime: string = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      let insUpdStatement: object;
      let mapName: string;
      let matchInfo: RowDataPacket[];
      if (matchApiCheck == 2 || matchApiCheck == 1) {
        res.status(401).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
        return;
      }
      sqlString = "SELECT map FROM veto WHERE match_id = ? ORDER BY id";
      vetoInfo = await db.query(sqlString, [event.matchid]);
      if (vetoInfo.length) {
        mapName = vetoInfo[event.map_number].map;
      } else {
        sqlString = "SELECT veto_mappool FROM `match` WHERE id = ?";
        matchInfo = await db.query(sqlString, [event.matchid]);
        mapName = matchInfo[0].veto_mappool.split(" ")[event.map_number];
      }
      sqlString =
        "SELECT id FROM map_stats WHERE match_id = ? AND map_number = ?";
      mapStatInfo = await db.query(sqlString, [
        event.matchid,
        event.map_number
      ]);
      if (mapStatInfo.length) {
        insUpdStatement = {
          map_number: event.map_number,
          map_name: mapName
        };
        sqlString =
          "UPDATE map_stats SET ? WHERE match_id = ? AND map_number = ?";
        insUpdStatement = await db.buildUpdateStatement(insUpdStatement);
        await db.query(sqlString, insUpdStatement);
      } else {
        insUpdStatement = {
          match_id: event.matchid,
          map_number: event.map_number,
          map_name: mapName,
          start_time: startTime,
          team1_score: 0,
          team2_score: 0
        };
        sqlString = "INSERT INTO map_stats SET ?";
        await db.query(sqlString, insUpdStatement);
        GlobalEmitter.emit("mapStatUpdate");
        res.status(200).send({ message: "Success" });
        return;
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
      return;
    }
  }
  static async OnPlayerDeath(
    apiKey: string,
    event: Get5_OnPlayerDeath,
    res: Response
  ) {
    try {
      const matchApiCheck: number = await Utils.checkApiKey(
        apiKey,
        event.matchid
      );
      if (matchApiCheck == 2 || matchApiCheck == 1) {
        res.status(401).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
        return;
      }
      // We do not care about bot deaths for live stats.
      if (event.player.is_bot) {
        res
          .status(200)
          .send({ message: "Bot players do not count towards stats." });
        return;
      }
      let sqlString: string;
      let mapInfo: RowDataPacket[];
      let insertObj: object;
      let playerTeamId: RowDataPacket[];
      let playerStatVals: RowDataPacket[];
      sqlString =
        "SELECT id FROM map_stats WHERE match_id = ? AND map_number = ?";
      mapInfo = await db.query(sqlString, [event.matchid, event.map_number]);

      sqlString =
        "SELECT team_id FROM team_auth_names JOIN `match` m " +
        "ON (m.team1_id = team_id OR m.team2_id = team_id) WHERE m.id = ? AND auth = ?";
      playerTeamId = await db.query(sqlString, [event.player.steamid]);
      insertObj = {
        match_id: event.matchid,
        map_id: mapInfo[0].id,
        team_id: playerTeamId[0].team_id,
        player_steam_id: event.player.steamid,
        player_name: event.player.name,
        player_side: event.player.side,
        round_number: event.round_number,
        round_time: event.round_time,
        attacker_steam_id: event.attacker.steamid,
        attacker_name: event.attacker.name,
        attacker_side: event.attacker.side,
        weapon: event.weapon.name,
        bomb: event.bomb,
        headshot: event.headshot,
        thru_smoke: event.thru_smoke,
        attacker_blind: event.attacker_blind,
        no_scope: event.no_scope,
        suicide: event.suicide,
        friendly_fire: event.friendly_fire,
        assister_steam_id: event.assist.player.steamid,
        assister_name: event.assist.player.name,
        assister_side: event.assist.player.side,
        assist_friendly_fire: event.assist.friendly_fire,
        flash_assist: event.assist.flash_assist
      };
      insertObj = await db.buildUpdateStatement(insertObj);
      sqlString = "INSERT INTO player_stat_extras SET ?";
      await db.query(sqlString, insertObj);

      // Update player stats for what we can here, start with the victim.
      sqlString =
        "SELECT id, deaths, suicides FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
      playerStatVals = await db.query(sqlString, [
        event.matchid,
        mapInfo[0].id,
        event.player.steamid
      ]);

      if (playerStatVals.length) {
        sqlString = "UPDATE player_stats SET ? WHERE id = ?";
        insertObj = {
          deaths: playerStatVals[0].deaths + 1,
          suicides: event.suicide ? playerStatVals[0].suicides + 1 : null
        };
        insertObj = await db.buildUpdateStatement(insertObj);
        await db.query(sqlString, [insertObj, playerStatVals[0].id]);
      } else {
        sqlString = "INSERT INTO player_stats SET ?";
        insertObj = {
          match_id: event.matchid,
          map_id: mapInfo[0].id,
          team_id: playerTeamId[0].team_id,
          steam_id: event.player.steamid,
          name: event.player.name,
          deaths: 1,
          suicides: event.suicide ? 1 : null
        };
        insertObj = await db.buildUpdateStatement(insertObj);
        await db.query(sqlString, insertObj);
      }

      if (event.attacker) {
        sqlString =
          "SELECT id, kills, headshot_kills, teamkills, knife_kills FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
        playerStatVals = await db.query(sqlString, [
          event.matchid,
          mapInfo[0].id,
          event.attacker.steamid
        ]);
        if (playerStatVals.length) {
          sqlString = "UPDATE player_stats SET ? WHERE id = ?";
          insertObj = {
            kills: playerStatVals[0].kills + 1,
            headshot_kills: event.headshot
              ? playerStatVals[0].headshot_kills + 1
              : null,
            teamkills: event.friendly_fire
              ? playerStatVals[0].teamkills + 1
              : null,
            knife_kills:
              event.weapon.id == 28 ||
              event.weapon.id == 50 ||
              event.weapon.id == 28 ||
              event.weapon.id == 59 ||
              event.weapon.id == 80 ||
              event.weapon.id > 500
                ? playerStatVals[0].knife_kills + 1
                : null
          };
          insertObj = await db.buildUpdateStatement(insertObj);
          await db.query(sqlString, [insertObj, playerStatVals[0].id]);
        } else {
          sqlString =
            "SELECT team_id FROM team_auth_names JOIN `match` m " +
            "ON (m.team1_id = team_id OR m.team2_id = team_id) WHERE m.id = ? AND auth = ?";
          playerStatVals = await db.query(sqlString, [event.attacker.steamid]);
          sqlString = "INESRT INTO player_stats SET ?";
          insertObj = {
            match_id: event.matchid,
            map_id: mapInfo[0].id,
            team_id: playerStatVals[0].team_id,
            steam_id: event.attacker.steamid,
            kills: 1,
            headshot_kills: event.headshot ? 1 : null,
            teamkills: event.friendly_fire ? 1 : null,
            knife_kills:
              event.weapon.id == 28 ||
              event.weapon.id == 50 ||
              event.weapon.id == 28 ||
              event.weapon.id == 59 ||
              event.weapon.id == 80 ||
              event.weapon.id > 500
                ? 1
                : null
          };
          insertObj = await db.buildUpdateStatement(insertObj);
          await db.query(sqlString, insertObj);
        }
      }

      if (event.assist) {
        sqlString =
          "SELECT id, assists, flashbang_assists FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
        playerStatVals = await db.query(sqlString, [
          event.matchid,
          mapInfo[0].id,
          event.assist.player.steamid
        ]);
        if (playerStatVals.length) {
          sqlString = "UPDATE player_stats SET ? WHERE id = ?";
          insertObj = {
            assists: playerStatVals[0].assists + 1,
            flashbang_assists: event.assist.flash_assist
              ? playerStatVals[0].flashbang_assists + 1
              : null
          };
          insertObj = await db.buildUpdateStatement(insertObj);
          await db.query(sqlString, [insertObj, playerStatVals[0].id]);
        } else {
          sqlString =
            "SELECT team_id FROM team_auth_names JOIN `match` m " +
            "ON (m.team1_id = team_id OR m.team2_id = team_id) WHERE m.id = ? AND auth = ?";
          playerStatVals = await db.query(sqlString, [
            event.assist.player.steamid
          ]);
          sqlString = "INESRT INTO player_stats SET ?";
          insertObj = {
            match_id: event.matchid,
            map_id: mapInfo[0].id,
            team_id: playerStatVals[0].team_id,
            steam_id: event.assist.player.steamid,
            assists: 1,
            flashbang_assists: event.assist.flash_assist ? 1 : null
          };
          insertObj = await db.buildUpdateStatement(insertObj);
          await db.query(sqlString, insertObj);
        }
      }
      GlobalEmitter.emit("playerStatsUpdate");
      res.status(200).send({ message: "Success" });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
      return;
    }
  }

  static async OnBombEvent(
    apiKey: string,
    event: Get5_OnBombEvent,
    res: Response,
    defused: boolean
  ) {
    try {
      const matchApiCheck: number = await Utils.checkApiKey(
        apiKey,
        event.matchid
      );
      if (matchApiCheck == 2 || matchApiCheck == 1) {
        res.status(401).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
        return;
      }
      let sqlString: string;
      let mapInfo: RowDataPacket[];
      let playerStatInfo: RowDataPacket[];
      let insObject: object;
      if (event.player.is_bot) {
        res
          .status(200)
          .send({ message: "Bot players do not count towards stats." });
        return;
      }
      sqlString =
        "SELECT id FROM map_stats WHERE match_id = ? AND map_number = ?";
      mapInfo = await db.query(sqlString, [event.matchid, event.map_number]);
      sqlString =
        "SELECT id FROM player_stats WHERE match_id = ? AND map_id = ? AND steam_id = ?";
      playerStatInfo = await db.query(sqlString, [
        event.matchid,
        mapInfo[0].id,
        event.player.steamid
      ]);

      insObject = {
        match_id: event.matchid,
        map_id: mapInfo[0].id,
        player_stat_id: playerStatInfo[0].id,
        round_number: event.round_number,
        round_time: event.round_time,
        site: event.site,
        defused: defused,
        bomb_time_remaining: event?.bomb_time_remaining
      };
      
      insObject = await db.buildUpdateStatement(insObject);
      sqlString = "INSERT INTO match_bomb_plant SET ?";
      await db.query(sqlString, insObject);
      GlobalEmitter.emit("bombEvent");
      return;
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
      return;
    }
  }

  static async OnMatchPausedUnPaused(
    apiKey: string,
    event: Get5_OnMatchPausedUnpaused,
    res: Response
  ) {
    const matchApiCheck: number = await Utils.checkApiKey(
      apiKey,
      event.matchid
    );
    let sqlString: string;
    let matchInfo: RowDataPacket[];
    let pauseInfo: RowDataPacket[];
    let insUpdStatement: object;
    let teamPaused: string;
    if (matchApiCheck == 2 || matchApiCheck == 1) {
      res.status(401).send({
        message:
          "Match already finalized or and invalid API key has been given."
      });
      return;
    }
    sqlString = "SELECT team1_string, team2_string FROM `match` WHERE id = ?";
    matchInfo = await db.query(sqlString, [event.matchid]);

    sqlString = "SELECT * FROM match_pause WHERE match_id = ?";
    pauseInfo = await db.query(sqlString, [event.matchid]);

    if (event.team == "team1") teamPaused = matchInfo[0].team1_string;
    else if (event.team == "team2") teamPaused = matchInfo[0].team1_string;
    else teamPaused = "Admin";

    if (pauseInfo.length) {
      sqlString = "UPDATE match_pause SET ? WHERE match_id = ?";
      insUpdStatement = {
        pause_type: event.pause_type,
        team_paused: teamPaused,
        paused: event.event == "game_paused" ? true : false
      };
      insUpdStatement = await db.buildUpdateStatement(insUpdStatement);
      await db.query(sqlString, insUpdStatement);
    } else {
      sqlString = "INSERT INTO match_pause SET ?";
      insUpdStatement = {
        match_id: event.matchid,
        pause_type: event.pause_type,
        team_paused: teamPaused,
        paused: event.event == "game_paused" ? true : false
      };
      insUpdStatement = await db.buildUpdateStatement(insUpdStatement);
      await db.query(sqlString, insUpdStatement);
    }
    GlobalEmitter.emit("matchUpdate");
    res.status(200).send({ message: "Success" });
    return;
  }
}

export default MapFlowService;
