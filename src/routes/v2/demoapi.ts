/** Express API router for demo uploads in get5.
 * @module routes/v2
 * @requires express
 * @requires db
 */


/**
 * @swagger
 * resourcePath: /v2/demo
 * description: Express API for v2 API calls in G5API.
 */

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

import { db } from "../../services/db.js";


