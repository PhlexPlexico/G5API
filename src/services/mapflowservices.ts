import {db} from "./db.js";

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

