/**
 * DatHost REST API client for creating, starting, stopping, and deleting game servers.
 * Used for on-the-fly server provisioning when use_dathost is true on match creation.
 * @module services/dathost
 */

import fetch, { FormData, Blob } from "node-fetch";
import config from "config";

const BASE_URL = "https://dathost.net/api/0.1";

export interface DatHostServerCreateOptions {
  name: string;
  rcon: string;
  steamGameServerLoginToken: string;
  game?: string;
}

export interface DatHostServerInfo {
  id: string;
  ip: string;
  ports: { game: number };
  rcon: string;
  status?: string;
  booting?: boolean;
  on?: boolean;
}

export interface CreateAndStartResult {
  id: string;
  ip: string;
  port: number;
  rcon: string;
}

function getAuthHeader(): string {
  const email = config.get<string>("dathost.email");
  const password = config.get<string>("dathost.password");
  const encoded = Buffer.from(`${email}:${password}`).toString("base64");
  return `Basic ${encoded}`;
}

function isDathostConfigured(): boolean {
  try {
    const email = config.get<string>("dathost.email");
    const password = config.get<string>("dathost.password");
    return Boolean(email && password);
  } catch {
    return false;
  }
}

/**
 * Create a game server on DatHost (does not start it).
 */
export async function createServer(
  options: DatHostServerCreateOptions
): Promise<DatHostServerInfo> {
  const body = new URLSearchParams();
  const game = options.game ?? "cs2";
  body.append("name", options.name);
  body.append("game", game);

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
  }

  const res = await fetch(`${BASE_URL}/game-servers`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
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
export async function startServer(dathostServerId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}/start`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader()
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
export async function getServer(
  dathostServerId: string
): Promise<DatHostServerInfo> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}`,
    {
      method: "GET",
      headers: {
        Authorization: getAuthHeader()
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
export async function stopServer(dathostServerId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}/stop`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader()
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
export async function deleteServer(dathostServerId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(dathostServerId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: getAuthHeader()
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

async function downloadToBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${url}`);
  }
  return res.arrayBuffer();
}

async function uploadFileToDathost(
  serverId: string,
  remotePath: string,
  data: ArrayBuffer,
  fileName: string
): Promise<void> {
  const fd = new FormData();
  fd.append("file", new Blob([data], { type: "application/zip" }), fileName);

  const res = await fetch(
    `${BASE_URL}/game-servers/${encodeURIComponent(serverId)}/files/${encodeURIComponent(remotePath)}`,
    {
      method: "POST",
      headers: { Authorization: getAuthHeader() },
      body: fd
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DatHost upload failed (${remotePath}): ${res.status} ${text}`);
  }
}

async function unzipOnDathost(
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
        Authorization: getAuthHeader(),
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

const CSS_GITHUB_LATEST =
  "https://api.github.com/repos/roflmuffin/CounterStrikeSharp/releases/latest";
const MATCHZY_GITHUB_LATEST =
  "https://api.github.com/repos/shobhit-pathak/MatchZy/releases/latest";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

async function installPlugins(serverId: string): Promise<void> {
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
  await uploadFileToDathost(serverId, "counterstrikesharp.zip", cssBuf, cssAsset.name);
  console.log("Extracting CounterStrikeSharp...");
  await unzipOnDathost(serverId, "counterstrikesharp.zip", "/");

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
  await uploadFileToDathost(serverId, "matchzy.zip", matchzyBuf, matchzyAsset.name);
  console.log("Extracting MatchZy...");
  await unzipOnDathost(serverId, "matchzy.zip", "/");

  console.log("Plugin installation complete.");
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Create a server, start it, and poll until it is ready (has ip and game port).
 * Returns connection details for use in game_server row and RCON.
 */
export async function createAndStartServer(
  options: DatHostServerCreateOptions
): Promise<CreateAndStartResult> {
  const server = await createServer(options);
  const id = server.id;
  const rcon = options.rcon;

  await installPlugins(id);
  await startServer(id);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let info: DatHostServerInfo;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    info = await getServer(id);
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

export { isDathostConfigured };

/**
 * Release a game server after match end or cancel: set in_use=0 for normal servers,
 * or for managed (DatHost) servers: stop and delete on DatHost, null match.server_id, delete game_server row.
 * Safe to call with null serverId (no-op).
 */
export async function releaseManagedServer(
  serverId: number | null | undefined
): Promise<void> {
  if (serverId == null) return;

  const { db } = await import("./db.js");
  const rows = await db.query(
    "SELECT id, dathost_server_id, is_managed FROM game_server WHERE id = ?",
    [serverId]
  );
  const row = Array.isArray(rows) ? rows[0] : (rows as any)?.[0];
  if (!row) return;

  if (row.is_managed && row.dathost_server_id) {
    const delaySeconds =
      (config.has("dathost.shutdown_delay_seconds") &&
        config.get<number>("dathost.shutdown_delay_seconds")) ||
      0;
    if (delaySeconds > 0) {
      await new Promise((r) => setTimeout(r, delaySeconds * 1000));
    }
    try {
      await stopServer(row.dathost_server_id);
    } catch (e) {
      console.error("DatHost stopServer error:", e);
    }
    try {
      await deleteServer(row.dathost_server_id);
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
