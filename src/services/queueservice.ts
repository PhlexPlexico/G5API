import config from "config";
import { createClient, RedisClientType } from "redis";
import { v4 as uuidv4 } from 'uuid';

// Wordlists for CS-themed queue ID generation
import { CS_ADJECTIVES_1, CS_ADJECTIVES_2, CS_NOUNS } from '../utility/csWordlists.js';

// Imported Interfaces
import { Queue } from '../types/queues/Queue.js';
import { PickPhaseDetails } from '../types/queues/PickPhaseDetails.js';
import { PickPhaseState } from '../types/queues/PickPhaseState.js';

class QueueService {
  private redisClient: RedisClientType<any, any, any>;
  private userQueueCreationLimit: number;
  private defaultQueueCapacity: number;

  constructor(redisUrl?: string) {
    const actualRedisUrl = redisUrl || config.get("server.redisUrl");
    this.redisClient = createClient({ url: actualRedisUrl });

    this.userQueueCreationLimit = config.get<number>('server.userQueueCreationLimit');
    this.defaultQueueCapacity = config.get<number>('server.defaultQueueCapacity');

    this.redisClient.on("error", (err) => {
      console.error("Redis error: ", err);
    });

    this.redisClient.connect().catch(err => {
      console.error("Failed to connect to Redis:", err);
    });
  }

  private async _generateQueueId(retryCount = 0): Promise<string> {
    const MAX_RETRIES = 10;
    if (retryCount >= MAX_RETRIES) {
      console.error("Failed to generate a unique CS-themed queue ID after several retries. Falling back to UUID.");
      return uuidv4();
    }

    const adj1 = CS_ADJECTIVES_1[Math.floor(Math.random() * CS_ADJECTIVES_1.length)];
    let adj2 = CS_ADJECTIVES_2[Math.floor(Math.random() * CS_ADJECTIVES_2.length)];

    // Ensure adj1 and adj2 are different if they happened to be picked from same list or have overlap
    // This is a simple way; more complex logic could be used if lists were identical.
    if (CS_ADJECTIVES_1.includes(adj2) && CS_ADJECTIVES_2.includes(adj1)) { // Check if they could potentially be from a shared pool
      while (adj1 === adj2) { // Re-pick adj2 if it's the same as adj1
        adj2 = CS_ADJECTIVES_2[Math.floor(Math.random() * CS_ADJECTIVES_2.length)];
      }
    }

    const noun = CS_NOUNS[Math.floor(Math.random() * CS_NOUNS.length)];
    const generatedId = `${adj1}${adj2}${noun}`;

    const idExists = await this.redisClient.exists(`queue:${generatedId}`);
    if (idExists) {
      console.warn(`Queue ID collision: ${generatedId}. Retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      return this._generateQueueId(retryCount + 1);
    }
    return generatedId;
  }

  private async _findUserServer(ownerSteamId: string, queueId: string): Promise<string | null> {
    console.log(`[Server Allocation] Attempting to find a free server for user ${ownerSteamId} for queue ${queueId}.`);
    return null;
  }

  private async _findPublicServer(queueId: string): Promise<string | null> {
    console.log(`[Server Allocation] Attempting to find a public server for queue ${queueId}.`);
    return null;
  }

  private async _setupDockerizedServer(queueId: string): Promise<string | null> {
    console.log(`[Docker Placeholder] Initiating Dockerized CS2 server setup for queue ${queueId}.`);
    console.log("[Docker Placeholder] Step 1: Check if Docker is available (simulated: yes).");
    console.log("[Docker Placeholder] Step 2: Pull CS2 server image (simulated: joedwards32/cs2).");
    console.log(`[Docker Placeholder] Step 3: Run Docker image for queue ${queueId} with MatchZy (simulated).`);
    const simulatedServerIp = "127.0.0.1";
    const simulatedPort = "27015";
    console.log(`[Docker Placeholder] Simulated server IP: ${simulatedServerIp}:${simulatedPort}`);
    return `${simulatedServerIp}:${simulatedPort}`;
  }


  async createQueue(ownerSteamId: string, capacity?: number): Promise<Queue | null> {
    const queueCapacity = capacity === undefined ? this.defaultQueueCapacity : capacity;

    try {
      const userQueuesCountKey = "user:queues:counts";
      const userOwnedQueuesKey = `user:${ownerSteamId}:owned_queues`;
      const currentQueueCountStr = await this.redisClient.hGet(userQueuesCountKey, ownerSteamId);
      const currentQueueCount = parseInt(currentQueueCountStr || "0", 10);

      if (currentQueueCount >= this.userQueueCreationLimit) {
        console.warn(`User ${ownerSteamId} has reached their queue creation limit of ${this.userQueueCreationLimit}.`);
        return null;
      }

      // _generateQueueId now handles uniqueness and fallback
      const queueId = await this._generateQueueId();
      const queueKey = `queue:${queueId}`;

      const newQueue: Queue = {
        id: queueId,
        ownerSteamId,
        capacity: queueCapacity,
        createdAt: Date.now(),
        status: 'waiting',
        members: [ownerSteamId]
      };

      const queueMembersKey = `queue:${queueId}:members`;
      const activeQueuesKey = "queues:active";
      const transaction = this.redisClient.multi();
      transaction.hSet(queueKey, {
        id: newQueue.id,
        ownerSteamId: newQueue.ownerSteamId,
        capacity: newQueue.capacity.toString(),
        createdAt: newQueue.createdAt.toString(),
        status: newQueue.status,
      });
      transaction.sAdd(queueMembersKey, ownerSteamId);
      transaction.hIncrBy(userQueuesCountKey, ownerSteamId, 1);
      transaction.sAdd(userOwnedQueuesKey, queueId);
      transaction.sAdd(activeQueuesKey, queueId);
      await transaction.exec();
      console.log(`Event: queue_created id <${queueId}> owner <${ownerSteamId}> capacity <${queueCapacity}>`);
      return newQueue;
    } catch (error) {
      console.error(`Error creating queue for ${ownerSteamId}:`, error);
      return null;
    }
  }

  async addPlayerToQueue(queueId: string, playerSteamId: string): Promise<boolean> {
    try {
      const queueKey = `queue:${queueId}`;
      const queueMembersKey = `queue:${queueId}:members`;
      if (!await this.redisClient.exists(queueKey)) {
        console.warn(`Attempted to add player to non-existent queue: ${queueId}`);
        return false;
      }
      const currentStatus = await this.redisClient.hGet(queueKey, "status");
      if (currentStatus !== 'waiting') {
        console.warn(`Attempted to add player to queue ${queueId} which is not in 'waiting' state (current: ${currentStatus}).`);
        return false;
      }
      const capacityStr = await this.redisClient.hGet(queueKey, "capacity");
      const capacity = parseInt(capacityStr || "0", 10);
      const currentMemberCount = await this.redisClient.sCard(queueMembersKey);
      if (currentMemberCount >= capacity) {
        console.log(`Queue ${queueId} is full. Cannot add player ${playerSteamId}.`);
        return false;
      }
      const added = await this.redisClient.sAdd(queueMembersKey, playerSteamId);
      if (added) {
        console.log(`Event: player_joined queue <${queueId}> player <${playerSteamId}>`);
        const newMemberCount = await this.redisClient.sCard(queueMembersKey);
        if (newMemberCount >= capacity) {
          console.log(`Queue <${queueId}> is now full with ${newMemberCount} members (capacity: ${capacity}). Triggering pop logic.`);
          await this._popQueue(queueId, capacity);
        }
        return true;
      } else {
        console.log(`Player ${playerSteamId} is already a member of queue ${queueId}.`);
        return true;
      }
    } catch (error) {
      console.error(`Error adding player ${playerSteamId} to queue ${queueId}:`, error);
      return false;
    }
  }

  private async _popQueue(queueId: string, capacity: number): Promise<void> {
    try {
      const queueMembersKey = `queue:${queueId}:members`;
      const queueKey = `queue:${queueId}`;
      const players = await this.redisClient.sMembers(queueMembersKey);
      if (players.length < capacity) {
        console.error(`Queue ${queueId} pop triggered with ${players.length} members, less than capacity ${capacity}. Aborting pop.`);
        return;
      }
      if (players.length < 2) {
        console.error(`Queue ${queueId} cannot select two captains from less than 2 players (${players.length}).`);
        await this.redisClient.hSet(queueKey, 'status', 'error_not_enough_players_for_captains');
        return;
      }
      const mainQueueData = await this.redisClient.hGetAll(queueKey);
      const originalOwnerSteamId = mainQueueData.ownerSteamId;
      if (!originalOwnerSteamId) {
        console.error(`Critical error: ownerSteamId not found for queue ${queueId} during pop. Aborting pop.`);
        await this.redisClient.hSet(queueKey, 'status', 'error_popping');
        return;
      }
      const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
      const captain1 = shuffledPlayers[0];
      const captain2 = shuffledPlayers[1];
      await this.redisClient.hSet(queueKey, 'status', 'picking');
      const poppedQueueDetailsKey = `popped_queue:${queueId}:details`;
      const poppedQueueDetailsData: PickPhaseDetails = {
        all_players: JSON.stringify(players),
        available_players: JSON.stringify(players.filter(p => p !== captain1 && p !== captain2)),
        captain1: captain1,
        captain2: captain2,
        team1_name: `${captain1}'s Team`,
        team2_name: `${captain2}'s Team`,
        team1_picks: JSON.stringify([captain1]),
        team2_picks: JSON.stringify([captain2]),
        next_picker: captain1,
        original_queue_id: queueId,
        original_owner_steam_id: originalOwnerSteamId,
        capacity: capacity.toString(),
        picks_made: "0"
      };
      const redisPoppedQueueDetails: Record<string, string> = {};
      for (const [key, value] of Object.entries(poppedQueueDetailsData)) {
        if (value !== undefined) {
          redisPoppedQueueDetails[key] = String(value);
        }
      }
      await this.redisClient.hSet(poppedQueueDetailsKey, redisPoppedQueueDetails);
      console.log(`Event: queue_popped queue ${queueId} capacity ${capacity}. Captains: ${captain1}, ${captain2}. Players: ${players.join(', ')}. Original owner: ${originalOwnerSteamId}`);
    } catch (error) {
      console.error(`Error popping queue ${queueId}:`, error);
      try {
        await this.redisClient.hSet(`queue:${queueId}`, 'status', 'error_popping');
      } catch (setError) {
        console.error(`Failed to set queue ${queueId} status to error_popping:`, setError);
      }
    }
  }

  async pickPlayerInQueue(
    queueId: string,
    requestingUserSteamId: string,
    playerToPickSteamId: string
  ): Promise<{ state: PickPhaseState | null, error?: string, status?: number }> {
    const poppedQueueDetailsKey = `popped_queue:${queueId}:details`;
    const mainQueueKey = `queue:${queueId}`;

    try {
      const details = await this.redisClient.hGetAll(poppedQueueDetailsKey) as unknown as PickPhaseDetails;
      if (!details || Object.keys(details).length === 0 || details.original_queue_id !== queueId) {
        return { state: null, error: 'Queue not found or not in picking state.', status: 404 };
      }
      const mainQueueStatus = await this.redisClient.hGet(mainQueueKey, 'status');
      if (mainQueueStatus !== 'picking') {
        return { state: null, error: 'Queue is not in picking phase.', status: 400 };
      }

      const capacity = parseInt(details.capacity, 10);
      const captain1 = details.captain1;
      const captain2 = details.captain2;
      let nextPicker = details.next_picker;
      let picksMade = parseInt(details.picks_made, 10);
      let availablePlayers: string[] = JSON.parse(details.available_players || "[]");
      let team1Picks: string[] = JSON.parse(details.team1_picks || "[]");
      let team2Picks: string[] = JSON.parse(details.team2_picks || "[]");
      const team1Name = details.team1_name;
      const team2Name = details.team2_name;
      const originalOwnerSteamId = details.original_owner_steam_id;

      if (requestingUserSteamId !== captain1 && requestingUserSteamId !== captain2) {
        return { state: null, error: 'Forbidden: You are not a captain in this queue.', status: 403 };
      }
      if (requestingUserSteamId !== nextPicker) {
        return { state: null, error: 'Forbidden: It is not your turn to pick.', status: 403 };
      }
      if (!availablePlayers.includes(playerToPickSteamId)) {
        return { state: null, error: 'Player not available or already picked.', status: 400 };
      }

      if (requestingUserSteamId === captain1) {
        team1Picks.push(playerToPickSteamId);
      } else {
        team2Picks.push(playerToPickSteamId);
      }
      availablePlayers = availablePlayers.filter(p => p !== playerToPickSteamId);
      picksMade++;

      const totalPlayersToPick = capacity - 2;
      let currentQueueFinalStatus: Queue['status'] = 'in_progress';
      let serverIp: string | null = null;

      const pickPhaseStateForReturn: PickPhaseState = {
        captain1, team1Name, team1Picks, captain2, team2Name, team2Picks,
        availablePlayers, nextPicker, picksMade, capacity, totalPlayersToPick,
        status: 'picking',
        serverIp: null
      };

      if (picksMade >= totalPlayersToPick || availablePlayers.length === 0) {
        pickPhaseStateForReturn.nextPicker = "picking_complete";
        nextPicker = "picking_complete";
        console.log(`Event: teams_finalized for queue ${queueId}. Team1: ${team1Picks.join(', ')}, Team2: ${team2Picks.join(', ')}`);

        if (originalOwnerSteamId) {
          serverIp = await this._findUserServer(originalOwnerSteamId, queueId);
        } else {
          console.error(`[Server Allocation] Original owner SteamID not found in popped_queue details for queue ${queueId}. Cannot search for user server.`);
        }

        if (!serverIp) {
          serverIp = await this._findPublicServer(queueId);
        }

        const updatesToPoppedDetails: Partial<PickPhaseDetails> = {};

        if (serverIp) {
          console.log(`[Server Allocation] Server ${serverIp} allocated for queue ${queueId}.`);
          currentQueueFinalStatus = 'in_progress_server_assigned';
          await this.redisClient.hSet(mainQueueKey, { status: currentQueueFinalStatus, server_ip: serverIp });
          updatesToPoppedDetails.server_ip = serverIp;
          pickPhaseStateForReturn.serverIp = serverIp;
        } else {
          console.log(`[Server Allocation] No existing server found. Attempting Docker server setup for ${queueId}.`);
          const dockerServerIp = await this._setupDockerizedServer(queueId);
          if (dockerServerIp) {
            console.log(`[Server Allocation] Docker server successfully provisioned: ${dockerServerIp} for queue ${queueId}.`);
            currentQueueFinalStatus = 'in_progress_server_assigned';
            await this.redisClient.hSet(mainQueueKey, { status: currentQueueFinalStatus, server_ip: dockerServerIp });
            updatesToPoppedDetails.server_ip = dockerServerIp;
            pickPhaseStateForReturn.serverIp = dockerServerIp;
            serverIp = dockerServerIp;
          } else {
            console.log(`[Server Allocation] Docker server setup failed for queue ${queueId}. Manual intervention required.`);
            currentQueueFinalStatus = 'error_server_allocation_failed';
            await this.redisClient.hSet(mainQueueKey, 'status', currentQueueFinalStatus);
          }
        }
        pickPhaseStateForReturn.status = currentQueueFinalStatus;

        if (Object.keys(updatesToPoppedDetails).length > 0) {
          const redisUpdates: Record<string, string> = {};
          for (const [key, value] of Object.entries(updatesToPoppedDetails)) {
            if (value !== undefined) redisUpdates[key] = String(value);
          }
          if (redisUpdates.server_ip) await this.redisClient.hSet(poppedQueueDetailsKey, { server_ip: redisUpdates.server_ip });
        }

      } else {
        pickPhaseStateForReturn.nextPicker = (requestingUserSteamId === captain1) ? captain2 : captain1;
        nextPicker = pickPhaseStateForReturn.nextPicker;
        pickPhaseStateForReturn.status = 'picking';
      }

      await this.redisClient.hSet(poppedQueueDetailsKey, {
        available_players: JSON.stringify(availablePlayers),
        team1_picks: JSON.stringify(team1Picks),
        team2_picks: JSON.stringify(team2Picks),
        next_picker: nextPicker,
        picks_made: picksMade.toString()
      });

      console.log(`Event: player_picked queue <${queueId}> captain <${requestingUserSteamId}> picked <${playerToPickSteamId}>`);

      return { state: pickPhaseStateForReturn };

    } catch (error) {
      console.error(`Error during pickPlayerInQueue for queue ${queueId}:`, error);
      return { state: null, error: 'Server error during picking process.', status: 500 };
    }
  }

  async removePlayerFromQueue(queueId: string, playerSteamId: string): Promise<boolean> {
    try {
      const queueKey = `queue:${queueId}`;
      const queueMembersKey = `queue:${queueId}:members`;
      if (!await this.redisClient.exists(queueKey)) {
        console.warn(`Attempted to remove player from non-existent queue: ${queueId}`);
        return false;
      }
      const ownerSteamId = await this.redisClient.hGet(queueKey, "ownerSteamId");
      const memberCount = await this.redisClient.sCard(queueMembersKey);
      if (ownerSteamId === playerSteamId && memberCount === 1) {
        console.warn(`Owner ${playerSteamId} cannot leave queue ${queueId} as the last member. Queue should be deleted instead.`);
        return false;
      }
      const currentStatus = await this.redisClient.hGet(queueKey, "status");
      if (['picking', 'in_progress', 'in_progress_server_assigned', 'pending_server_manual', 'completed', 'error_server_allocation_failed'].includes(currentStatus || '')) {
        console.warn(`Player ${playerSteamId} cannot leave queue ${queueId} as it is in status: ${currentStatus}.`);
        return false;
      }
      const removed = await this.redisClient.sRem(queueMembersKey, playerSteamId);
      if (removed) {
        console.log(`Event: player_left queue <${queueId}> player <${playerSteamId}>`);
        return true;
      } else {
        console.log(`Player ${playerSteamId} not found in queue ${queueId}.`);
        return false;
      }
    } catch (error) {
      console.error(`Error removing player ${playerSteamId} from queue ${queueId}:`, error);
      return false;
    }
  }

  async getQueueDetails(queueId: string): Promise<Queue | null> {
    try {
      const queueKey = `queue:${queueId}`;
      const queueData = await this.redisClient.hGetAll(queueKey);
      if (!queueData || Object.keys(queueData).length === 0) {
        console.log(`Queue details not found for queueId: ${queueId}`);
        return null;
      }
      const members = await this.redisClient.sMembers(`queue:${queueId}:members`);
      return {
        id: queueData.id,
        ownerSteamId: queueData.ownerSteamId,
        capacity: parseInt(queueData.capacity, 10),
        createdAt: parseInt(queueData.createdAt, 10),
        status: queueData.status as Queue['status'],
        members: members || [],
        server_ip: queueData.server_ip
      };
    } catch (error) {
      console.error(`Error fetching details for queue ${queueId}:`, error);
      return null;
    }
  }

  async listUserQueues(ownerSteamId: string): Promise<Queue[]> {
    try {
      const userOwnedQueuesKey = `user:${ownerSteamId}:owned_queues`;
      const queueIds = await this.redisClient.sMembers(userOwnedQueuesKey);
      if (!queueIds || queueIds.length === 0) {
        return [];
      }
      const queues: Queue[] = [];
      for (const queueId of queueIds) {
        const details = await this.getQueueDetails(queueId);
        if (details) {
          queues.push(details);
        }
      }
      return queues;
    } catch (error) {
      console.error(`Error listing queues for user ${ownerSteamId}:`, error);
      return [];
    }
  }

  async listAllQueues(): Promise<Queue[]> {
    try {
      const activeQueuesKey = "queues:active";
      const queueIds = await this.redisClient.sMembers(activeQueuesKey);
      if (!queueIds || queueIds.length === 0) {
        return [];
      }
      const queues: Queue[] = [];
      for (const queueId of queueIds) {
        const details = await this.getQueueDetails(queueId);
        if (details) {
          queues.push(details);
        }
      }
      return queues;
    } catch (error) {
      console.error("Error listing all active queues:", error);
      return [];
    }
  }

  async deleteQueue(queueId: string, requestingUserSteamId: string): Promise<boolean> {
    try {
      const queueKey = `queue:${queueId}`;
      const ownerSteamId = await this.redisClient.hGet(queueKey, "ownerSteamId");
      if (!ownerSteamId) {
        console.warn(`Queue ${queueId} not found for deletion attempt by ${requestingUserSteamId}.`);
        return false;
      }
      if (requestingUserSteamId !== ownerSteamId) {
        console.warn(`User ${requestingUserSteamId} attempted to delete queue ${queueId} owned by ${ownerSteamId}. Permission denied.`);
        return false;
      }
      const queueMembersKey = `queue:${queueId}:members`;
      const activeQueuesKey = "queues:active";
      const userQueuesCountKey = "user:queues:counts";
      const userOwnedQueuesKey = `user:${ownerSteamId}:owned_queues`;
      const poppedQueueDetailsKey = `popped_queue:${queueId}:details`;
      const transaction = this.redisClient.multi();
      transaction.del(queueKey);
      transaction.del(queueMembersKey);
      transaction.del(poppedQueueDetailsKey);
      transaction.sRem(activeQueuesKey, queueId);
      transaction.sRem(userOwnedQueuesKey, queueId);
      transaction.hIncrBy(userQueuesCountKey, ownerSteamId, -1);
      await transaction.exec();
      console.log(`Event: queue_deleted id <${queueId}> requested_by <${requestingUserSteamId}>`);
      return true;
    } catch (error) {
      console.error(`Error deleting queue ${queueId} by user ${requestingUserSteamId}:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.disconnect();
      console.log("Redis client disconnected.");
    }
  }
}

export default QueueService;