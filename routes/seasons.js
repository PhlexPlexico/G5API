/**
 * @swagger
 * resourcePath: /seasons
 * description: Express API router for seasons in get5.
 */

import { Router } from "express";

import config from "config";

import fetch from "node-fetch";

const router = Router();

import db from "../db.js";

import Utils from "../utility/utils.js";

/**
 * @swagger
 *
 * components:
 *   schemas:
 *    SeasonData:
 *      type: object
 *      required:
 *        - server_id
 *        - name
 *        - start_date
 *      properties:
 *        server_id:
 *          type: integer
 *          description: Unique server ID.
 *        name:
 *          type: string
 *          description: The name of the Season to be created.
 *        start_date:
 *          type: string
 *          format: date-time
 *          description: Season start date.
 *        end_date:
 *          type: string
 *          format: date-time
 *          description: Optional season end date.
 *        season_cvar:
 *          type: object
 *          description: Objects for default CVARs when selecting a season.
 *    cvars:
 *      type: object
 *      description: Key value pairs representing convars for the match server. Key is command and value is what to set it to.
 *
 *   responses:
 *     NoSeasonData:
 *       description: No season data was provided.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimpleResponse'
 */

/**
 * @swagger
 *
 * /seasons/:
 *   get:
 *     description: Get all seasons from the application.
 *     produces:
 *       - application/json
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: All seasons within the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SeasonData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res, next) => {
  try {
    let sql =
      "SELECT s.id, s.user_id, s.name, s.start_date, s.end_date, " +
      "CONCAT('{', GROUP_CONCAT(DISTINCT CONCAT('\"',sc.cvar_name,'\": \"',sc.cvar_value,'\"')),'}') as cvars " +
      "FROM season s LEFT OUTER JOIN season_cvar sc " +
      "ON s.id = sc.season_id " +
      "GROUP BY s.id, s.user_id, s.name, s.start_date, s.end_date";
    let seasons = await db.query(sql);
    if (!seasons.length) {
      res.status(404).json({ message: "No seasons found." });
      return;
    }
    for (let row in seasons) {
      if (seasons[row].cvars == null) delete seasons[row].cvars;
      else seasons[row].cvars = JSON.parse(seasons[row].cvars);
    }
    res.json({ seasons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons/myseasons:
 *   get:
 *     description: Set of seasons from the logged in user.
 *     produces:
 *       - application/json
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SeasonData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/myseasons", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let sql =
      "SELECT s.id, s.user_id, s.name, s.start_date, s.end_date, " +
      "CONCAT('{', GROUP_CONCAT(DISTINCT CONCAT('\"',sc.cvar_name,'\"',': \"',sc.cvar_value,'\"')),'}') as cvars " +
      "FROM season s LEFT OUTER JOIN season_cvar sc " +
      "ON s.id = sc.season_id " +
      "WHERE s.user_id = ? " +
      "GROUP BY s.id, s.user_id, s.name, s.start_date, s.end_date";
    let seasons = await db.query(sql, [req.user.id]);
    if (!seasons.length) {
      res.status(404).json({ message: "No seasons found." });
      return;
    }
    for (let row in seasons) {
      if (seasons[row].cvars == null) delete seasons[row].cvars;
      else seasons[row].cvars = JSON.parse(seasons[row].cvars);
    }
    res.json({ seasons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons/myseasons/availble:
 *   get:
 *     description: Set of seasons from the logged in user that can currently be used.
 *     produces:
 *       - application/json
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: All seasons of a user that are still running.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SeasonData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get(
  "/myseasons/available",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    let sql;
    let seasons;
    try {
      // Check if super admin, if they are use this query.
      if (Utils.superAdminCheck(req.user)) {
        sql =
          "SELECT s.id, s.user_id, s.name, s.start_date, s.end_date, " +
          "CONCAT('{', GROUP_CONCAT(DISTINCT CONCAT('\"',sc.cvar_name,'\"',': \"',sc.cvar_value,'\"')),'}') as cvars " +
          "FROM season s LEFT OUTER JOIN season_cvar sc " +
          "ON s.id = sc.season_id " +
          "WHERE s.end_date >= CURDATE() " +
          "OR s.end_date IS NULL " +
          "GROUP BY s.id, s.user_id, s.name, s.start_date, s.end_date";
        seasons = await db.query(sql, [req.user.id]);
      } else {
        sql =
          "SELECT s.id, s.user_id, s.name, s.start_date, s.end_date, " +
          "CONCAT('{', GROUP_CONCAT(DISTINCT CONCAT('\"',sc.cvar_name,'\"',': \"',sc.cvar_value,'\"')),'}') as cvars " +
          "FROM season s LEFT OUTER JOIN season_cvar sc " +
          "ON s.id = sc.season_id " +
          "WHERE s.user_id = ? " +
          "AND (s.end_date >= CURDATE() " +
          "OR s.end_date IS NULL) " +
          "GROUP BY s.id, s.user_id, s.name, s.start_date, s.end_date";
        seasons = await db.query(sql, [req.user.id]);
      }
      if (!seasons.length) {
        res.status(404).json({ message: "No seasons found." });
        return;
      }
      for (let row in seasons) {
        if (seasons[row].cvars == null) delete seasons[row].cvars;
        else seasons[row].cvars = JSON.parse(seasons[row].cvars);
      }
      res.json({ seasons });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.toString() });
    }
  }
);

/**
 * @swagger
 *
 * /seasons/:season_id/cvar:
 *   get:
 *     description: Get the default CVARs of a given season ID.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: season_id
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: All matches within the system.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/cvars'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get(
  "/:season_id/cvar",
  Utils.ensureAuthenticated,
  async (req, res, next) => {
    try {
      let sql =
        "SELECT CONCAT('{', GROUP_CONCAT(DISTINCT CONCAT('\"',sc.cvar_name,'\"',': \"',sc.cvar_value,'\"')),'}') as cvars " +
        "FROM season_cvar sc " +
        "WHERE sc.season_id = ? ";
      let cvar = await db.query(sql, [req.params.season_id]);
      if (cvar[0].cvars == null) {
        res.status(404).json({
          message: "No cvars found for season id " + req.params.season_id + ".",
        });
        return;
      }
      for (let row in cvar) {
        if (cvar[row].cvars == null) delete cvar[row].cvars;
        else cvar[row].cvars = JSON.parse(cvar[row].cvars);
      }
      res.json(cvar[0]);
    } catch (err) {
      res.status(500).json({ message: err.toString() });
    }
  }
);

/**
 * @swagger
 *
 * /seasons/:season_id:
 *   get:
 *     description: Set of matches from a season.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: season_id
 *         required: true
 *         schema:
 *          type: integer
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Season stats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MatchData'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/:season_id", async (req, res, next) => {
  try {
    let seasonID = req.params.season_id;
    let sql =
      "SELECT id, user_id, server_id, team1_id, team2_id, winner, team1_score, team2_score, team1_series_score, team2_series_score, team1_string, team2_string, cancelled, forfeit, start_time, end_time, max_maps, title, skip_veto, private_match, enforce_teams, min_player_ready, season_id, is_pug FROM `match` where season_id = ?";
    let seasonSql = "SELECT * FROM season WHERE id = ?";
    let seasons = await db.query(seasonSql, seasonID);
    let matches = await db.query(sql, seasonID);
    if (!seasons.length) {
      res.status(404).json({ message: "Season not found." });
      return;
    }
    const season = JSON.parse(JSON.stringify(seasons[0]));
    res.json({ matches, season });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons:
 *   post:
 *     description: Create a new season.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/SeasonData'
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: New season inserted successsfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let defaultCvar = req.body[0].season_cvar;
    let insertSet = {
      user_id: req.user.id,
      name: req.body[0].name,
      start_date: req.body[0].start_date,
      end_date: req.body[0].end_date,
    };
    let sql = "INSERT INTO season SET ?";
    let insertSeason = await db.query(sql, [insertSet]);
    if (defaultCvar != null) {
      sql = "INSERT INTO season_cvar SET ?";
      for (let key in defaultCvar) {
        insertSet = {
          season_id: insertSeason.insertId,
          cvar_name: key.replace(/"/g, '\\"'),
          cvar_value: typeof defaultCvar[key] === 'string' ? defaultCvar[key].replace(/"/g, '\\"').replace(/\\/g, '\\\\') : defaultCvar[key]
        };
        await db.query(sql, [insertSet]);
      }
    }
    res.json({
      message: "Season inserted successfully!",
      id: insertSeason.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

/**
 * @swagger
 *
 * /seasons:
 *   put:
 *     description: Update a season.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/SeasonData'
 *
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: New season inserted successsfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       412:
 *         $ref: '#/components/responses/NoSeasonData'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  let seasonUserId = "SELECT user_id FROM season WHERE id = ?";
  if (req.body[0].season_id == null) {
    res.status(400).json({ message: "No season ID provided." });
    return;
  }
  const seasonRow = await db.query(seasonUserId, req.body[0].season_id);
  if (!seasonRow.length) {
    res.status(404).json({ message: "No season found." });
    return;
  } else if (
    seasonRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      let defaultCvar = req.body[0].season_cvar;
      let updateStmt = {
        user_id: req.body[0].user_id,
        name: req.body[0].name,
        start_date: req.body[0].start_date,
        end_date: req.body[0].end_date,
      };
      // Remove any values that may not be updated.
      // Change this as we are allowed null values within this update.
      updateStmt = await db.buildUpdateStatement(updateStmt);
      // Force getting the end date.
      updateStmt.end_date = req.body[0].end_date;
      if (!Object.keys(updateStmt)) {
        res
          .status(412)
          .json({ message: "No update data has been provided." });
        return;
      }
      let sql = "UPDATE season SET ? WHERE id = ?";
      await db.query(sql, [updateStmt, req.body[0].season_id]);
      if (defaultCvar != null) {
        sql = "DELETE FROM season_cvar WHERE season_id = ?";
        await db.query(sql, [req.body[0].season_id]);
        sql = "INSERT INTO season_cvar SET ?";
        for (let key in defaultCvar) {
          let insertSet = {
            season_id: req.body[0].season_id,
            cvar_name: key.replace(/"/g, '\\"'),
            cvar_value: typeof defaultCvar[key] === 'string' ? defaultCvar[key].replace(/"/g, '\\"').replace(/\\/g, '\\\\') : defaultCvar[key],
          };
          await db.query(sql, [insertSet]);
        }
      }
      res.json({ message: "Season updated successfully!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.toString() });
    }
  }
});

/**
 * @swagger
 *
 * /seasons:
 *   delete:
 *     description: Delete a season object. NULLs any linked matches to the season as well.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              season_id:
 *                type: integer
 *                required: true
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: Season deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.delete("/", async (req, res, next) => {
  let seasonUserId = "SELECT user_id FROM season WHERE id = ?";
  const seasonRow = await db.query(seasonUserId, req.body[0].season_id);
  if (seasonRow[0] == null) {
    res.status(404).json({ message: "No season found." });
    return;
  } else if (
    seasonRow[0].user_id != req.user.id &&
    !Utils.superAdminCheck(req.user)
  ) {
    res
      .status(403)
      .json({ message: "User is not authorized to perform action." });
    return;
  } else {
    try {
      let deleteSql = "DELETE FROM season WHERE id = ?";
      let seasonId = req.body[0].season_id;
      await db.query(deleteSql, [seasonId]);
      res.json({ message: "Season deleted successfully!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.toString() });
    }
  }
});

/**
 * @swagger
 *
 * /seasons/challonge:
 *   post:
 *     description: Create a new season from a Challonge Tournament.
 *     produces:
 *       - application/json
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: array
 *            items:
 *              type: object
 *              properties:
 *                tournament_id:
 *                  type: string
 *                  description: The tournament ID or URL of the Challonge tournament, as explained in their [API](https://api.challonge.com/v1/documents/tournaments/show).
 *                import_teams:
 *                  type: boolean
 *                  description: Whether or not to import the teams that are already in the bracket.
 *     tags:
 *       - seasons
 *     responses:
 *       200:
 *         description: New season inserted successsfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post("/challonge", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    const userInfo = await db.query("SELECT challonge_api_key FROM user WHERE id = ?", [req.user.id]);
    let challongeAPIKey = Utils.decrypt(userInfo[0].challonge_api_key);
    if (!challongeAPIKey) {
      throw "No challonge API key provided for user.";
    }
    let tournamentId = req.body[0].tournament_id;
    let challongeResponse = await fetch(
      "https://api.challonge.com/v1/tournaments/" +
      tournamentId +
      ".json?api_key=" +
      challongeAPIKey +
      "&include_participants=1");
    let challongeData = await challongeResponse.json()
    if (challongeData) {
      // Insert the season.
      let sqlString = "INSERT INTO season SET ?";
      let seasonData = {
        user_id: req.user.id,
        name: challongeData.tournament.name,
        start_date: new Date(challongeData.tournament.created_at),
        is_challonge: true,
        challonge_svg: challongeData.tournament.live_image_url,
        challonge_url: tournamentId
      };
      const insertSeason = await db.query(sqlString, seasonData);
      // Check if teams were already in the call and add them to the database.
      if (req.body[0]?.import_teams && challongeData.tournament.participants) {
        sqlString = "INSERT INTO team (user_id, name, tag, challonge_team_id) VALUES ?";
        let teamArray = [];
        challongeData.tournament.participants.forEach(async team => {
          teamArray.push([
            req.user.id,
            team.participant.display_name.substring(0, 40),
            team.participant.display_name.substring(0, 40),
            team.participant.id
          ]);
        });
        await db.query(sqlString, [teamArray]);
      }
      res.json({
        message: "Challonge season imported successfully!",
        chal_res: challongeData.tournament.created_at,
        id: insertSeason.insertId,
      });
    }

    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

export default router;
