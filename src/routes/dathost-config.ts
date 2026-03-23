/**
 * @swagger
 * resourcePath: /dathost-config
 * description: API for managing DatHost credentials stored encrypted in the database.
 */

import { Router } from "express";
import Utils from "../utility/utils.js";
import {
  getDathostConfig,
  isValidDatHostLocationId,
  setDathostConfig
} from "../services/dathost.js";

const router = Router();

/**
 * @swagger
 *
 * /dathost-config:
 *   get:
 *     description: Get current user DatHost configuration. Password and token are masked.
 *     produces:
 *       - application/json
 *     tags:
 *       - dathost-config
 *     responses:
 *       200:
 *         description: Current DatHost config.
 *       401:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    const cfg = await getDathostConfig(req.user!.id);
    if (!cfg) {
      res.json({
        email: "",
        password: "",
        steam_game_server_login_token: "",
        shutdown_delay_seconds: 0,
        preferred_location: "",
        configured: false
      });
      return;
    }

    res.json({
      email: cfg.email,
      password: cfg.password ? "********" : "",
      steam_game_server_login_token: cfg.steamGameServerLoginToken
        ? "********"
        : "",
      shutdown_delay_seconds: cfg.shutdownDelaySeconds,
      preferred_location: cfg.preferredLocation,
      configured: Boolean(cfg.email && cfg.password && cfg.preferredLocation)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 *
 * /dathost-config:
 *   put:
 *     description: Set DatHost configuration for the authenticated user. Credentials are encrypted before storage.
 *     produces:
 *       - application/json
 *     tags:
 *       - dathost-config
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               steam_game_server_login_token:
 *                 type: string
 *               shutdown_delay_seconds:
 *                 type: integer
 *               preferred_location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Config saved.
 *       401:
 *         $ref: '#/components/responses/Error'
 *       400:
 *         $ref: '#/components/responses/Error'
 */
router.put("/", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    const {
      email,
      password,
      steam_game_server_login_token,
      shutdown_delay_seconds,
      preferred_location
    } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof preferred_location !== "string" ||
      !preferred_location
    ) {
      res
        .status(400)
        .json({
          message:
            "email, password, and preferred_location are required strings."
        });
      return;
    }

    if (!isValidDatHostLocationId(preferred_location)) {
      res.status(400).json({ message: "Invalid preferred_location value." });
      return;
    }

    await setDathostConfig(
      req.user!.id,
      email,
      password,
      steam_game_server_login_token ?? "",
      typeof shutdown_delay_seconds === "number" ? shutdown_delay_seconds : 0,
      preferred_location
    );

    res.json({ message: "DatHost configuration saved." });
  } catch (err) {
    next(err);
  }
});

export default router;
