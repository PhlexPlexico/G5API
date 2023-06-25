import { db } from "./db.js";
import { Get5_OnSeriesResult } from "../types/series_flow/Get5_OnSeriesResult.js";
import { Get5_OnMapVetoed } from "../types/series_flow/veto/Get5_OnMapVetoed.js";
import { Get5_OnMapPicked } from "../types/series_flow/veto/Get5_OnMapPicked.js";
import { Get5_OnSidePicked } from "../types/series_flow/veto/Get5_OnSidePicked.js";
import { Get5_OnBackupRestore } from "../types/series_flow/Get5_OnBackupRestore.js";
import { Get5_OnMapResult } from "../types/series_flow/Get5_OnMapResult.js";
import GlobalEmitter from "../utility/emitter.js";
import { RowDataPacket } from "mysql2";
import { Response } from "express";
import Utils from "../utility/utils.js";
import update_challonge_match from "../services/challonge.js";

class SeriesFlowService {
  static async OnSeriesResult(event: Get5_OnSeriesResult, res: Response) {
    try {
      // Check if match has been finalized.
      let winnerId: number | null = null;
      let cancelled: number | null = null;
      let endTime: string = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      let updateObject: {};

      const matchInfo: RowDataPacket[] = await db.query(
        "SELECT team1_id, team2_id, max_maps, start_time, server_id, is_pug, season_id FROM `match` WHERE id = ?",
        [event.matchid]
      );
      if (event.winner?.team === "team1") winnerId = matchInfo[0]?.team1_id;
      else if (event.winner?.team === "team2")
        winnerId = matchInfo[0]?.team2_id;
      // BO2 situation.
      else if (
        event.winner?.team === "none" &&
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
      return res.status(200).send({ message: "Success" });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error)
        return res.status(500).send({ message: error.message });
      else return res.status(500).send({ message: error });
    }
  }

  static async OnMapResult(event: Get5_OnMapResult, res: Response) {
    try {
      let updateStmt: object = {};
      let sqlString: string;
      let matchInfo: RowDataPacket[];
      let mapInfo: RowDataPacket[];
      let mapEndTime: string = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      let winnerId: number | null | string = null;
      sqlString =
        "SELECT is_pug, max_maps, season_id FROM `match` WHERE id = ?";
      matchInfo = await db.query(sqlString, [event.matchid]);
      sqlString =
        "SELECT id FROM `map_stats` WHERE match_id = ? AND map_number = ?";
      mapInfo = await db.query(sqlString, [event.matchid, event.map_number]);
      if (mapInfo.length < 1) {
        return res
          .status(404)
          .send({ message: "Failed to find map stats object." });
      }
      if (event.winner?.team == "team1") {
        winnerId = event.team1.id;
      } else if (event.winner?.team == "team2") {
        winnerId = event.team2.id;
      }
      updateStmt = {
        end_time: mapEndTime,
        winner: winnerId
      };

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
      return res.status(200).send({ message: "Success" });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error)
        return res.status(500).send({ message: error.message });
      else return res.status(500).send({ message: error });
    }
  }

  static async OnMapVetoed(event: Get5_OnMapVetoed, res: Response) {
    try {
      await this.insertPickOrBan(
        "veto",
        event.matchid,
        event.map_name,
        event.team
      );
      return res.status(200).send({ message: "Success" });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error)
        return res.status(500).send({ message: error.message });
      else return res.status(500).send({ message: error });
    }
  }

  static async OnMapPicked(event: Get5_OnMapPicked, res: Response) {
    try {
      await this.insertPickOrBan(
        "pick",
        event.matchid,
        event.map_name,
        event.team
      );
      return res.status(200).send({ message: "Success" });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error)
        return res.status(500).send({ message: error.message });
      else return res.status(500).send({ message: error });
    }
  }

  static async OnSidePicked(event: Get5_OnSidePicked, res: Response) {
    try {
      let sqlString: string =
        "SELECT team1_id, team2_id FROM `match` WHERE id = ?";
      let teamPickId: number;
      let teamBanId: number;
      let nameResRow: RowDataPacket[];
      let teamPickMapString: string = "Default";
      let teamPickSideString: string = "Default";
      let vetoId: number;
      let insertObj: Object;
      // No side was chosen, perhaps was default? Ignore the event.
      if (!event.side) {
        return res.status(200).send({ message: "Success" });
      }
      if (event.team !== null) {
        const matchInfo: RowDataPacket[] = await db.query(sqlString, [
          event.matchid
        ]);
        // Need to get the initial veto data to link back to the veto table.
        // If team1 is picking sides, that means team2 picked the map.
        if (event.team === "team1") {
          teamPickId = matchInfo[0].team1_id;
          teamBanId = matchInfo[0].team2_id;
        } else if (event.team === "team2") {
          teamPickId = matchInfo[0].team2_id;
          teamBanId = matchInfo[0].team1_id;
        }
        sqlString = "SELECT name FROM team WHERE id = ?";
        nameResRow = await db.query(sqlString, [teamBanId!]);
        teamPickMapString = nameResRow[0].name;
        nameResRow = await db.query(sqlString, [teamPickId!]);
        teamPickSideString = nameResRow[0].name;
      }

      // Retrieve veto id with team name and map veto.
      sqlString =
        "SELECT id FROM veto WHERE match_id = ? AND team_name = ? AND map = ?";
      const vetoInfo = await db.query(sqlString, [
        event.matchid,
        teamPickMapString,
        event.map_name
      ]);
      vetoId = vetoInfo[0]?.id;

      // Insert into veto_side now.
      insertObj = {
        match_id: event.matchid,
        veto_id: vetoId,
        team_name: teamPickSideString,
        map: event.map_name,
        side: event.side
      };

      insertObj = await db.buildUpdateStatement(insertObj);
      sqlString = "INSERT INTO veto_side SET ?";
      await db.query(sqlString, [insertObj]);
      GlobalEmitter.emit("vetoSideUpdate");
      return res.status(200).send({ message: "Success" });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error)
        return res.status(500).send({ message: error.message });
      else return res.status(500).send({ message: error });
    }
  }

  static async OnBackupRestore(event: Get5_OnBackupRestore, res: Response) {
    // Logic for this is to fix a bug in user stats when a round restore happens. In previous iterations of the API
    // we would not care if a user would restore the match, which could lead to misrepresentation of stats.
    // This route will now fix this issue by seeking out all the data that's > the current round where it can,
    // and mark a value that will ensure the remaining player stats are updated as such.
    // The main chunk of update logic will then take place in the map flow service, on the OnRoundEnd function
    // as we get all the player information from that call.
    let sqlString: string =
      "DELETE FROM player_stat_extras " +
      "WHERE match_id = ? AND " +
      "map_id = (SELECT id FROM map_stats WHERE match_id = ? AND map_number = ?) AND " +
      "round_number >= ?";
    await db.query(sqlString, [
      event.matchid,
      event.matchid,
      event.map_number,
      event.round_number
    ]);
    sqlString =
      "UPDATE `map_stats` SET round_restored = 1 WHERE match_id = ? AND map_number = ?";
    await db.query(sqlString, [event.matchid, event.map_number]);
    return res.status(200).send({ message: "Success" });
  }

  private static async insertPickOrBan(
    vetoOrBan: string,
    matchid: string,
    map_name: string,
    team: string
  ) {
    let insertObj: object;
    let sqlString: string;
    let teamId: number;
    let teamString: string;
    let teamInfo: RowDataPacket[];
    let matchInfo: RowDataPacket[];

    sqlString = "SELECT team1_id, team2_id, id FROM `match` WHERE id = ?";
    // XXX: Maybe change the DB to use team1 and team2 and use a join query to retrieve the actual names?
    matchInfo = await db.query(sqlString, [matchid]);
    if (team === "team1") teamId = matchInfo[0].team1_id;
    else if (team === "team2") teamId = matchInfo[0].team2_id;
    else teamId = -1;

    if (teamId == -1) {
      teamString = "Decider";
    } else {
      sqlString = "SELECT name FROM team WHERE id = ?";
      teamInfo = await db.query(sqlString, [teamId]);
      teamString = teamInfo[0].name;
    }

    // All values should be present, no need to remove any unneeded variables.
    insertObj = {
      match_id: matchid,
      team_name: teamString,
      map: map_name,
      pick_or_veto: vetoOrBan
    };

    sqlString = "INSERT INTO veto SET ?";
    await db.query(sqlString, [insertObj]);
    GlobalEmitter.emit("vetoUpdate");
  }
}

export default SeriesFlowService;
