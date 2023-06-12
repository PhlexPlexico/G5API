import { Get5_OnSeriesResult } from "../types/series_flow/Get5_OnSeriesResult.js";
import Utils from "../utility/utils.js";
import { NextFunction, Request, Response } from "express";
import { db } from "./db.js";
import { RowDataPacket } from "mysql2";
import update_challonge_match from "../services/challonge.js";
import { Get5_OnMapResult } from "../types/series_flow/Get5_OnMapResult.js";
import GlobalEmitter from "../utility/emitter.js"
import { Get5_OnMapVetoed } from "../types/series_flow/veto/Get5_OnMapVetoed.js";
import { Get5_OnMapPicked } from "../types/series_flow/veto/Get5_OnMapPicked.js";
import { Get5_OnSidePicked } from "../types/series_flow/veto/Get5_OnSidePicked.js";
class SeriesFlowService {
  static async OnSeriesResult(
    apiKey: string,
    event: Get5_OnSeriesResult,
    res: Response
  ) {
    try {
      // Check if match has been finalized.
      const matchApiCheck: number = await Utils.checkApiKey(apiKey, event.matchid);
      let winnerId: number | null = null;
      let cancelled: number | null = null;
      let endTime: string = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      let updateObject: {};
      // As of right now there is no way to track forfeits via API calls.
      // let forfeit: number = event.
      // Match is finalized, this is usually called after a cancel so we just ignore the value with a 200 response.
      if (matchApiCheck == 2) {
        res.status(200).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
        return;
      } else if (matchApiCheck == 1) {
        res.status(401).send({
          message:
            "Match already finalized or and invalid API key has been given."
        });
        return;
      }

      const matchInfo: RowDataPacket[] = await db.query(
        "SELECT team1_id, team2_id, max_maps, start_time, server_id, is_pug, season_id FROM `match` WHERE id = ?",
        [event.matchid]
      );
      if (event.winner.team === "team1") winnerId = matchInfo[0]?.team1_id;
      else if (event.winner.team === "team2") winnerId = matchInfo[0]?.team2_id;
      // BO2 situation.
      else if (
        event.winner.team === "none" &&
        matchInfo[0].max_maps != 2 &&
        event.team1_series_score == 0 &&
        event.team2_series_score == 0
      ) {
        winnerId = null;
        cancelled = 1;
      }

      updateObject = {
        winner: winnerId,
        team1_score: event.team1_series_score,
        team2_score: event.team2_series_score,
        start_time:
          matchInfo[0].start_time ||
          new Date().toISOString().slice(0, 19).replace("T", " "),
        end_time: endTime,
        cancelled: cancelled
      };

      updateObject = await db.buildUpdateStatement(updateObject);
      let updateSql: string = "UPDATE `match` SET ? WHERE id = ?";
      await db.query(updateSql, [updateObject, event.matchid]);
      // Set server to not be in use.
      updateSql = "UPDATE game_server SET in_use = 0 WHERE id = ?";
      await db.query(updateSql, [matchInfo[0].server_id]);

      // Check if we are pugging.
      if (matchInfo[0].is_pug != null && matchInfo[0].is_pug == 1) {
        let mapStatSql: string =
          "SELECT id FROM map_stats WHERE match_id = ? ORDER BY map_number DESC";
        const finalMapStatInfo: RowDataPacket[] = await db.query(mapStatSql, [
          event.matchid
        ]);
        let mapStatInfoId: number | null = finalMapStatInfo[0]?.id;
        let newMapStatObject: RowDataPacket[];
        if (!finalMapStatInfo.length) {
          let newMapStatStmt: object = {
            start_time: new Date().toISOString().slice(0, 19).replace("T", " "),
            end_time: new Date().toISOString().slice(0, 19).replace("T", " "),
            winner: null,
            team1_score: 0,
            team2_score: 0,
            match_id: event.matchid
          };
          mapStatSql = "INSERT map_stats SET ?";
          newMapStatObject = await db.query(mapStatSql, [newMapStatStmt]);
          mapStatInfoId = newMapStatObject[0].insert_id;
        }
        await Utils.updatePugStats(
          event.matchid,
          mapStatInfoId!,
          matchInfo[0].team1_id,
          matchInfo[0].team2_id,
          winnerId!
        );
      }

      // Check if a match has a season ID and we're not cancelled.
      if (matchInfo[0].season_id && !cancelled) {
        await update_challonge_match(
          event.matchid,
          matchInfo[0].season_id,
          matchInfo[0].team1_id,
          matchInfo[0].team2_id,
          matchInfo[0].max_maps,
          event.winner.team
        );
      }
      GlobalEmitter.emit("matchUpdate");
      res.status(200).send({ message: "Success" });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).send({message: error});
    }
  }

  static async OnMapResult(
    apiKey: string,
    event: Get5_OnMapResult,
    res: Response
  ) {
    try {
      const matchApiCheck: number = await Utils.checkApiKey(
        apiKey,
        event.matchid
      );
      let updateStmt: object = {};
      let sqlString: string;
      let matchInfo: RowDataPacket[];
      let mapInfo: RowDataPacket[];
      let mapEndTime: string = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      let winnerId: number | null | string = null;

      if (matchApiCheck == 2 || matchApiCheck == 1) {
        res.status(401).send({
          message: "Match already finalized or and invalid API key has been given."
        });
        return;
      }
      sqlString =
        "SELECT is_pug, max_maps, season_id FROM `match` WHERE id = ?";
      matchInfo = await db.query(sqlString, [event.matchid]);
      sqlString =
        "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      mapInfo = await db.query(sqlString, [event.matchid, event.map_number]);
      if (mapInfo.length < 1) {
        res.status(404).send({ message: "Failed to find map stats object." });
        return;
      }
      if (event.winner.team == "team1") {
        winnerId = event.team1.id;
      }
      else if (event.winner.team == "team2") {
        winnerId = event.team2.id;
      }
      updateStmt = {
        end_time: mapEndTime,
        winner: winnerId
      }

      sqlString = "UPDATE map_stats SET ? WHERE id = ?";
      updateStmt = await db.buildUpdateStatement(updateStmt);
      await db.query(sqlString, [updateStmt, mapInfo[0].id]);

      // Update match table.
      updateStmt = {
        team1_score: event.team1.series_score,
        team2_score: event.team2.series_score
      };

      updateStmt = await db.buildUpdateStatement(updateStmt);
      sqlString = "UPDATE `match` SET ? WHERE ID = ?";
      await db.query(sqlString, [updateStmt, event.matchid]);

      if (matchInfo[0].is_pug != null && matchInfo[0].is_pug == 1) {
        await Utils.updatePugStats(
          event.matchid,
          mapInfo[0].id,
          +event.team1.id,
          +event.team2.id,
          +winnerId!,
          false
        );
      }

      GlobalEmitter.emit("mapStatUpdate");
      res.status(200).send({ message: "Success" });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
    }
  }

  static async OnMapVetoed(
    apiKey: string,
    event: Get5_OnMapVetoed,
    res: Response
  ) {
    try {

    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
    }
  }

  static async OnMapPicked(
    apiKey: string,
    event: Get5_OnMapPicked,
    res: Response
  ) {
    try {
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
    }
  }

  static async OnSidePicked(
    apiKey: string,
    event: Get5_OnSidePicked,
    res: Response
  ) {
    try {
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
    }
  }
}

export default SeriesFlowService;
