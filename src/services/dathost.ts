/**
 * DatHost REST API client for creating, starting, stopping, and deleting game servers.
 * Used for on-the-fly server provisioning when use_dathost is true on match creation.
 * @module services/dathost
 */

import fetch from "node-fetch";
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
  body.append("name", options.name);
  body.append("game", options.game ?? "cs2");
  body.append("csgo_settings.rcon", options.rcon);
  body.append(
    "csgo_settings.steam_game_server_login_token",
    options.steamGameServerLoginToken
  );

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

  await startServer(id);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let info: DatHostServerInfo;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    info = await getServer(id);
    if (info.ip && info.ports?.game) {
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
