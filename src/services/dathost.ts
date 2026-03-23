/**
 * DatHost REST API client for creating, starting, stopping, and deleting game servers.
 * Used for on-the-fly server provisioning when use_dathost is true on match creation.
 * @module services/dathost
 */

import fetch, { FormData, Blob } from "node-fetch";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import os from "os";
import Utils from "../utility/utils.js";
import { DatHostConfig } from "../types/dathost/DatHostConfig.js";
import { DatHostServerCreateOptions } from "../types/dathost/DatHostServerCreateOptions.js";
import { DatHostServerInfo } from "../types/dathost/DatHostServerInfo.js";
import { CreateAndStartResult } from "../types/dathost/CreateAndStartResult.js";

const BASE_URL = "https://dathost.net/api/0.1";
const CSS_GITHUB_LATEST =
  "https://api.github.com/repos/roflmuffin/CounterStrikeSharp/releases/latest";
const MATCHZY_GITHUB_LATEST =
  "https://api.github.com/repos/shobhit-pathak/MatchZy/releases/latest";
const GET5_GITHUB_LATEST =
  "https://api.github.com/repos/splewis/get5/releases/latest";
const STEAMWORKS_GITHUB_LATEST =
  "https://api.github.com/repos/KyleSanderson/SteamWorks/releases/latest";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300000; // 5 minutes

const execFileAsync = promisify(execFile);

const configCache = new Map<number, DatHostConfig | null>();

const DATHOST_LOCATION_IDS = [
  "prague",
  "copenhagen",
  "helsinki",
  "strasbourg",
  "dusseldorf",
  "dublin",
  "milan",
  "amsterdam",
  "oslo",
  "warsaw",
  "bucharest",
  "barcelona",
  "stockholm",
  "bristol",
  "beauharnois",
  "new_york_city",
  "los_angeles",
  "miami",
  "chicago",
  "portland",
  "dallas",
  "atlanta",
  "denver",
  "sydney",
  "hong_kong",
  "mumbai",
  "tokyo",
  "auckland",
  "singapore",
  "seoul",
  "buenos_aires",
  "sao_paulo",
  "santiago",
  "johannesburg",
  "istanbul",
  "dubai"
] as const;

function isValidDatHostLocationId(value: string): boolean {
  return DATHOST_LOCATION_IDS.includes(value as (typeof DATHOST_LOCATION_IDS)[number]);
}

async function getDathostConfig(userId: number): Promise<DatHostConfig | null> {
  const cached = configCache.get(userId);
  if (cached !== undefined) return cached;

  const { db } = await import("./db.js");
  const rows = await db.query(
    "SELECT email, password, steam_game_server_login_token, shutdown_delay_seconds, preferred_location FROM dathost_config WHERE user_id = ? LIMIT 1",
    [userId]
  );
  const row = Array.isArray(rows) ? rows[0] : (rows as any)?.[0];
  if (!row) {
    configCache.set(userId, null);
    return null;
  }

  const config = {
    email: Utils.decrypt(row.email) ?? "",
    password: Utils.decrypt(row.password) ?? "",
    steamGameServerLoginToken:
      Utils.decrypt(row.steam_game_server_login_token) ?? "",
    shutdownDelaySeconds: row.shutdown_delay_seconds ?? 0,
    preferredLocation: row.preferred_location ?? ""
  };
  configCache.set(userId, config);
  return config;
}

async function setDathostConfig(
  userId: number,
  email: string,
  password: string,
  steamToken: string,
  shutdownDelay: number,
  preferredLocation: string
): Promise<void> {
  if (!isValidDatHostLocationId(preferredLocation)) {
    throw new Error("Invalid DatHost preferred location.");
  }

  const { db } = await import("./db.js");
  const encEmail = Utils.encrypt(email);
  const encPassword = Utils.encrypt(password);
  const encToken = Utils.encrypt(steamToken);

  const existing = await db.query(
    "SELECT id FROM dathost_config WHERE user_id = ? LIMIT 1",
    [userId]
  );
  const row = Array.isArray(existing) ? existing[0] : (existing as any)?.[0];

  if (row) {
    await db.query(
      "UPDATE dathost_config SET email = ?, password = ?, steam_game_server_login_token = ?, shutdown_delay_seconds = ?, preferred_location = ? WHERE user_id = ?",
      [encEmail, encPassword, encToken, shutdownDelay, preferredLocation, userId]
    );
  } else {
    await db.query(
      "INSERT INTO dathost_config (user_id, email, password, steam_game_server_login_token, shutdown_delay_seconds, preferred_location) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, encEmail, encPassword, encToken, shutdownDelay, preferredLocation]
    );
  }

  configCache.delete(userId);
}

async function getAuthHeader(userId: number): Promise<string> {
  const cfg = await getDathostConfig(userId);
  if (!cfg) {
    throw new Error(`DatHost credentials not configured for user ${userId}`);
  }
  const encoded = Buffer.from(`${cfg.email}:${cfg.password}`).toString(
    "base64"
  );
  return `Basic ${encoded}`;
}

async function isDathostConfigured(userId: number): Promise<boolean> {
  try {
    const cfg = await getDathostConfig(userId);
    return Boolean(cfg && cfg.email && cfg.password && cfg.preferredLocation);
  } catch {
    return false;
  }
}



async function downloadToBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${url}`);
  }
  return res.arrayBuffer();
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
}

async function extractSteamworksExtensionFromTgz(
  archiveData: ArrayBuffer
): Promise<ArrayBuffer> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "steamworks-"));
  const archivePath = path.join(tempDir, "package-lin.tgz");
  const extensionPath = path.join(
    tempDir,
    "package",
    "addons",
    "sourcemod",
    "extensions",
    "SteamWorks.ext.so"
  );

  try {
    await writeFile(archivePath, Buffer.from(archiveData));
    await execFileAsync("tar", ["-xzf", archivePath, "-C", tempDir]);
    const extensionBuf = await readFile(extensionPath);
    return toArrayBuffer(extensionBuf);
  } catch (err) {
    throw new Error(
      `Failed to extract SteamWorks.ext.so from tgz archive: ${(err as Error).message}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function uploadFileToDathost(
  userId: number,
  serverId: string,
  remotePath: string,
  data: ArrayBuffer,
  fileName: string
): Promise<void> {
  const contentType = fileName.endsWith(".zip")
    ? "application/zip"
    : fileName.endsWith(".tgz") || fileName.endsWith(".tar.gz")
      ? "application/gzip"
      : "application/octet-stream";
  const fd = new FormData();
  fd.append("file", new Blob([data], { type: contentType }), fileName);

  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(serverId)}/files/${encodeURIComponent(remotePath)}`,
    {
      method: "POST",
      headers: { Authorization: await getAuthHeader(userId) },
      body: fd
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DatHost upload failed (${remotePath}): ${res.status} ${text}`);
  }
}

async function unzipOnDathost(
  userId: number,
  serverId: string,
  zipPath: string,
  destination: string
): Promise<void> {
  const body = new URLSearchParams();
  body.append("destination", destination);

  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(serverId)}/unzip/${encodeURIComponent(zipPath)}`,
    {
      method: "POST",
      headers: {
        Authorization: await getAuthHeader(userId),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DatHost unzip failed (${zipPath}): ${res.status} ${text}`);
  }
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

type SupportedDatHostGame = "cs2" | "csgo";

function resolveSupportedGame(game: string | undefined): SupportedDatHostGame {
  const resolved = game ?? "cs2";
  if (resolved !== "cs2" && resolved !== "csgo") {
    throw new Error(`Unsupported DatHost game: ${resolved}. Expected "cs2" or "csgo".`);
  }
  return resolved;
}

async function installCs2Plugins(userId: number, serverId: string): Promise<void> {
  const releaseRes = await fetch(CSS_GITHUB_LATEST, {
    headers: { "User-Agent": "G5API" }
  });
  if (!releaseRes.ok) {
    throw new Error(
      `Failed to fetch CSS latest release: ${releaseRes.status}`
    );
  }
  const release = (await releaseRes.json()) as { assets: GitHubAsset[] };
  const cssAsset = release.assets.find((a) =>
    a.name.includes("with-runtime-linux")
  );
  if (!cssAsset) {
    throw new Error("CounterStrikeSharp with-runtime-linux asset not found in latest release");
  }

  console.log(`Downloading CounterStrikeSharp: ${cssAsset.name}`);
  const cssBuf = await downloadToBuffer(cssAsset.browser_download_url);
  console.log(`Uploading CounterStrikeSharp (${cssBuf.byteLength} bytes) to DatHost...`);
  await uploadFileToDathost(
    userId,
    serverId,
    "counterstrikesharp.zip",
    cssBuf,
    cssAsset.name
  );
  console.log("Extracting CounterStrikeSharp...");
  await unzipOnDathost(userId, serverId, "counterstrikesharp.zip", "/");

  const matchzyReleaseRes = await fetch(MATCHZY_GITHUB_LATEST, {
    headers: { "User-Agent": "G5API" }
  });
  if (!matchzyReleaseRes.ok) {
    throw new Error(
      `Failed to fetch MatchZy latest release: ${matchzyReleaseRes.status}`
    );
  }
  const matchzyRelease = (await matchzyReleaseRes.json()) as { assets: GitHubAsset[] };
  const matchzyAsset = matchzyRelease.assets.find(
    (a) => a.name.endsWith(".zip") && !a.name.includes("with-cssharp")
  );
  if (!matchzyAsset) {
    throw new Error("MatchZy plugin-only zip asset not found in latest release");
  }

  console.log(`Downloading MatchZy: ${matchzyAsset.name}`);
  const matchzyBuf = await downloadToBuffer(matchzyAsset.browser_download_url);
  console.log(`Uploading MatchZy (${matchzyBuf.byteLength} bytes) to DatHost...`);
  await uploadFileToDathost(userId, serverId, "matchzy.zip", matchzyBuf, matchzyAsset.name);
  console.log("Extracting MatchZy...");
  await unzipOnDathost(userId, serverId, "matchzy.zip", "/");

  console.log("Plugin installation complete.");
}

async function installCsgoPlugins(userId: number, serverId: string): Promise<void> {
  const get5ReleaseRes = await fetch(GET5_GITHUB_LATEST, {
    headers: { "User-Agent": "G5API" }
  });
  if (!get5ReleaseRes.ok) {
    throw new Error(
      `Failed to fetch get5 latest release: ${get5ReleaseRes.status}`
    );
  }

  const get5Release = (await get5ReleaseRes.json()) as { assets: GitHubAsset[] };
  const get5Asset = get5Release.assets.find((a) => a.name.endsWith(".zip"));
  if (!get5Asset) {
    throw new Error("get5 zip asset not found in latest release");
  }

  const steamworksReleaseRes = await fetch(STEAMWORKS_GITHUB_LATEST, {
    headers: { "User-Agent": "G5API" }
  });
  if (!steamworksReleaseRes.ok) {
    throw new Error(
      `Failed to fetch SteamWorks latest release: ${steamworksReleaseRes.status}`
    );
  }
  const steamworksRelease = (await steamworksReleaseRes.json()) as { assets: GitHubAsset[] };
  const steamworksAsset =
    steamworksRelease.assets.find((a) => a.name === "package-lin.tgz") ??
    steamworksRelease.assets.find((a) => a.name.endsWith(".tgz")) ??
    steamworksRelease.assets.find((a) => a.name.endsWith(".tar.gz")) ??
    steamworksRelease.assets.find((a) => a.name.endsWith(".zip"));
  if (!steamworksAsset) {
    throw new Error("SteamWorks archive asset not found in latest release");
  }

  console.log(`Downloading SteamWorks: ${steamworksAsset.name}`);
  const steamworksBuf = await downloadToBuffer(steamworksAsset.browser_download_url);
  if (
    steamworksAsset.name.endsWith(".tgz") ||
    steamworksAsset.name.endsWith(".tar.gz")
  ) {
    console.log("Extracting SteamWorks extension locally from tgz...");
    const steamworksExtensionBuf = await extractSteamworksExtensionFromTgz(
      steamworksBuf
    );
    console.log(
      `Uploading SteamWorks.ext.so (${steamworksExtensionBuf.byteLength} bytes) to DatHost...`
    );
    await uploadFileToDathost(
      userId,
      serverId,
      "addons/sourcemod/extensions/SteamWorks.ext.so",
      steamworksExtensionBuf,
      "SteamWorks.ext.so"
    );
  } else {
    console.log(`Uploading SteamWorks (${steamworksBuf.byteLength} bytes) to DatHost...`);
    const steamworksRemoteArchivePath = steamworksAsset.name;
    await uploadFileToDathost(
      userId,
      serverId,
      steamworksRemoteArchivePath,
      steamworksBuf,
      steamworksAsset.name
    );
    console.log("Extracting SteamWorks...");
    await unzipOnDathost(userId, serverId, steamworksRemoteArchivePath, "/");
  }

  console.log(`Downloading get5: ${get5Asset.name}`);
  const get5Buf = await downloadToBuffer(get5Asset.browser_download_url);
  console.log(`Uploading get5 (${get5Buf.byteLength} bytes) to DatHost...`);
  await uploadFileToDathost(userId, serverId, "get5.zip", get5Buf, get5Asset.name);
  console.log("Extracting get5...");
  await unzipOnDathost(userId, serverId, "get5.zip", "/");
  console.log("")
  console.log("Plugin installation complete.");
}

async function installPlugins(
  userId: number,
  serverId: string,
  game: SupportedDatHostGame
): Promise<void> {
  if (game === "cs2") {
    await installCs2Plugins(userId, serverId);
    return;
  }
  await installCsgoPlugins(userId, serverId);
}

/**
 * Create a game server on DatHost (does not start it).
 */
async function createServer(
  userId: number,
  options: DatHostServerCreateOptions
): Promise<DatHostServerInfo> {
  const cfg = await getDathostConfig(userId);
  const preferredLocation = cfg?.preferredLocation ?? "";
  if (!isValidDatHostLocationId(preferredLocation)) {
    throw new Error("DatHost preferred location is missing or invalid.");
  }

  const body = new URLSearchParams();
  const game = resolveSupportedGame(options.game);
  body.append("name", options.name);
  body.append("game", game);
  body.append("location", preferredLocation);
  body.append("autostop", "true");
  body.append("autostop_minutes", "10"); // This can be a configurable value

  if (game === "cs2") {
    body.append("cs2_settings.rcon", options.rcon);
    body.append(
      "cs2_settings.steam_game_server_login_token",
      options.steamGameServerLoginToken
    );
    body.append("cs2_settings.enable_metamod", "true");
  } else {
    body.append("csgo_settings.rcon", options.rcon);
    body.append(
      "csgo_settings.steam_game_server_login_token",
      options.steamGameServerLoginToken
    );
    body.append("csgo_settings.enable_sourcemod", "true");
  }

  const res = await fetch(`${BASE_URL}/game-servers`, {
    method: "POST",
    headers: {
      Authorization: await getAuthHeader(userId),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DatHost create server failed: ${res.status} ${text}`);
  }

  return (await res.json()) as DatHostServerInfo;
}

/**
 * Start a game server on DatHost.
 */
async function startServer(userId: number, dathostServerId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}/start`,
    {
      method: "POST",
      headers: {
        Authorization: await getAuthHeader(userId)
      }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `DatHost start server failed: ${res.status} ${text}`
    );
  }
}

/**
 * Get current game server details (ip, ports, status).
 */
async function getServer(
  userId: number,
  dathostServerId: string
): Promise<DatHostServerInfo> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}`,
    {
      method: "GET",
      headers: {
        Authorization: await getAuthHeader(userId)
      }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DatHost get server failed: ${res.status} ${text}`);
  }

  return (await res.json()) as DatHostServerInfo;
}

/**
 * Stop a game server on DatHost.
 */
async function stopServer(userId: number, dathostServerId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}/stop`,
    {
      method: "POST",
      headers: {
        Authorization: await getAuthHeader(userId)
      }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DatHost stop server failed: ${res.status} ${text}`);
  }
}

/**
 * Delete a game server on DatHost.
 */
async function deleteServer(userId: number, dathostServerId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: await getAuthHeader(userId)
      }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `DatHost delete server failed: ${res.status} ${text}`
    );
  }
}

/**
 * Create a server, start it, and poll until it is ready (has ip and game port).
 * Returns connection details for use in game_server row and RCON.
 */
async function createAndStartServer(
  userId: number,
  options: DatHostServerCreateOptions
): Promise<CreateAndStartResult> {
  const game = resolveSupportedGame(options.game);
  const server = await createServer(userId, options);
  const id = server.id;
  const rcon = options.rcon;

  await installPlugins(userId, id, game);
  await startServer(userId, id);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let info: DatHostServerInfo;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    info = await getServer(userId, id);
    if (info.ip && info.ports?.game && info.on && !info.booting) {
      return {
        id,
        ip: info.ip,
        port: info.ports.game,
        rcon
      };
    }
  }

  throw new Error(
    "DatHost server did not become ready in time (missing ip or game port)"
  );
}

/**
 * Release a game server after match end or cancel: set in_use=0 for normal servers,
 * or for managed (DatHost) servers: stop and delete on DatHost, null match.server_id, delete game_server row.
 * Safe to call with null serverId (no-op).
 */
async function releaseManagedServer(
  serverId: number | null | undefined
): Promise<void> {
  if (serverId == null) return;

  const { db } = await import("./db.js");
  const rows = await db.query(
    "SELECT id, user_id, dathost_server_id, is_managed FROM game_server WHERE id = ?",
    [serverId]
  );
  const row = Array.isArray(rows) ? rows[0] : (rows as any)?.[0];
  if (!row) return;

  if (row.is_managed && row.dathost_server_id) {
    const ownerUserId = Number(row.user_id);
    const cfg = Number.isFinite(ownerUserId) && ownerUserId > 0
      ? await getDathostConfig(ownerUserId)
      : null;
    const delaySeconds = cfg?.shutdownDelaySeconds || 0;
    if (delaySeconds > 0) {
      await new Promise((r) => setTimeout(r, delaySeconds * 1000));
    }
    try {
      if (ownerUserId > 0) {
        await stopServer(ownerUserId, row.dathost_server_id);
      } else {
        throw new Error("Managed DatHost server has no owner user_id");
      }
    } catch (e) {
      console.error("DatHost stopServer error:", e);
    }
    try {
      if (ownerUserId > 0) {
        await deleteServer(ownerUserId, row.dathost_server_id);
      } else {
        throw new Error("Managed DatHost server has no owner user_id");
      }
    } catch (e) {
      console.error("DatHost deleteServer error:", e);
    }
    await db.query("UPDATE `match` SET server_id = NULL WHERE server_id = ?", [
      serverId
    ]);
    await db.query("DELETE FROM game_server WHERE id = ?", [serverId]);
  } else {
    await db.query("UPDATE game_server SET in_use = 0 WHERE id = ?", [
      serverId
    ]);
  }
}

export {
  DATHOST_LOCATION_IDS,
  isValidDatHostLocationId,
  getDathostConfig,
  setDathostConfig,
  createServer,
  startServer,
  getServer,
  stopServer,
  deleteServer,
  createAndStartServer,
  isDathostConfigured,
  releaseManagedServer
};
