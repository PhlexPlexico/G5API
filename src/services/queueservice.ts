import config from "config";
import { createClient, RedisClientType } from "redis";
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import GlobalEmitter from '../utility/emitter.js';

// Wordlists for CS-themed queue ID generation
import { CS_ADJECTIVES_1, CS_ADJECTIVES_2, CS_NOUNS } from '../utility/csWordlists.js';

// Imported Interfaces
import { Queue } from '../types/queues/Queue.js';
import { PickPhaseDetails } from '../types/queues/PickPhaseDetails.js';
import { PickPhaseState } from '../types/queues/PickPhaseState.js';
import { VetoDetails } from '../types/queues/VetoDetails.js';

const DEFAULT_MAP_POOL = ['de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_anubis', 'de_vertigo', 'de_ancient'];

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

  private async _findUserServer(ownerSteamId: string, queueId: string, pickedMap: string): Promise<string | null> {
    console.debug(`[Server Allocation] Attempting to find a free server for user ${ownerSteamId}, queue ${queueId}, map ${pickedMap}.`);
    return null;
  }

  private async _findPublicServer(queueId: string, pickedMap: string): Promise<string | null> {
    console.debug(`[Server Allocation] Attempting to find a public server for queue ${queueId}, map ${pickedMap}.`);
    return null;
  }

  private async _setupDockerizedServer(queueId: string, pickedMap: string): Promise<string | null> {
    console.debug(`[Docker Placeholder] Initiating Dockerized CS2 server setup for queue ${queueId} with map ${pickedMap}.`);
    console.debug("[Docker Placeholder] Step 1: Check if Docker is available (simulated: yes).");
    console.debug("[Docker Placeholder] Step 2: Pull CS2 server image (simulated: joedwards32/cs2).");
    console.debug(`[Docker Placeholder] Step 3: Run Docker image for queue ${queueId} on map ${pickedMap} with MatchZy (simulated).`);
    const simulatedServerIp = "127.0.0.1";
    const simulatedPort = "27015";
    console.debug(`[Docker Placeholder] Simulated server IP: ${simulatedServerIp}:${simulatedPort}`);
    return `${simulatedServerIp}:${simulatedPort}`;
  }


  async createQueue(ownerSteamId: string, capacity?: number): Promise<Queue | null> {
    let queueCapacity: number = capacity === undefined ? this.defaultQueueCapacity : capacity;

    try {
      const userQueuesCountKey = "user:queues:counts";
      const userOwnedQueuesKey = `user:${ownerSteamId}:owned_queues`;
      const currentQueueCountStr = await this.redisClient.hGet(userQueuesCountKey, ownerSteamId);
      const currentQueueCount = parseInt(currentQueueCountStr || "0", 10);

      if (currentQueueCount >= this.userQueueCreationLimit) {
        console.warn(`User ${ownerSteamId} has reached their queue creation limit of ${this.userQueueCreationLimit}.`);
        return null;
      } else if (queueCapacity < 2) {
        console.warn(`User ${ownerSteamId} attempted to create a queue with capacity < 2. Defaulting to ${this.defaultQueueCapacity}.`);
        queueCapacity = this.defaultQueueCapacity;
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
      GlobalEmitter.emit('queue_event', { type: 'queue_created', queueId: newQueue.id, data: newQueue });
      return newQueue;
    } catch (error) {
      console.error(`Error creating queue for ${ownerSteamId}:`, error);
      return null;
    }
  }

  async updateQueueCapacity(queueId: string, newCapacity: number): Promise<{ success: boolean, message?: string, status?: number }> {
    const queueKey = `queue:${queueId}`;
    try {
      const queueExists = await this.redisClient.exists(queueKey);
      if (!queueExists) {
        return { success: false, message: 'Queue not found.', status: 404 };
      }

      const currentStatus = await this.redisClient.hGet(queueKey, "status");
      if (currentStatus !== 'waiting') {
        return { success: false, message: `Queue capacity can only be updated if in 'waiting' state. Current state: ${currentStatus}`, status: 409 };
      }

      if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
        return { success: false, message: 'Capacity must be a positive integer.', status: 400 };
      }

      const queueMembersKey = `queue:${queueId}:members`;
      const currentMemberCount = await this.redisClient.sCard(queueMembersKey);
      if (currentMemberCount > newCapacity) {
        return { success: false, message: `New capacity (${newCapacity}) cannot be less than current member count (${currentMemberCount}).`, status: 409 };
      }

      await this.redisClient.hSet(queueKey, "capacity", newCapacity.toString());
      GlobalEmitter.emit('queue_event', { type: 'queue_capacity_updated', queueId: queueId, data: { newCapacity: newCapacity } });
      return { success: true, message: 'Queue capacity updated successfully.' };

    } catch (error) {
      console.error(`Error updating capacity for queue ${queueId}:`, error);
      return { success: false, message: 'Server error updating queue capacity.', status: 500 };
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
        console.warn(`Queue ${queueId} is full. Cannot add player ${playerSteamId}.`);
        return false;
      }
      const added = await this.redisClient.sAdd(queueMembersKey, playerSteamId);
      if (added) {
        const members = await this.redisClient.sMembers(queueMembersKey);
        GlobalEmitter.emit('queue_event', { type: 'player_joined', queueId: queueId, data: { playerSteamId: playerSteamId, members: members } });
        const newMemberCount = members.length; // Use length of fetched members
        if (newMemberCount >= capacity) {
          await this._popQueue(queueId, capacity);
        }
        return true;
      } else {
        // Emit event even if player was already in queue, as client might want to know about the attempt or refresh state.
        const members = await this.redisClient.sMembers(queueMembersKey);
        GlobalEmitter.emit('queue_event', { type: 'player_joined', queueId: queueId, data: { playerSteamId: playerSteamId, members: members } });
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
        GlobalEmitter.emit('queue_event', { type: 'queue_status_changed', queueId: queueId, data: { status: 'error_not_enough_players_for_captains' } });
        return;
      }
      const mainQueueData = await this.redisClient.hGetAll(queueKey);
      const originalOwnerSteamId = mainQueueData.ownerSteamId;
      if (!originalOwnerSteamId) {
        console.error(`Critical error: ownerSteamId not found for queue ${queueId} during pop. Aborting pop.`);
        await this.redisClient.hSet(queueKey, 'status', 'error_popping');
        GlobalEmitter.emit('queue_event', { type: 'queue_status_changed', queueId: queueId, data: { status: 'error_popping' } });
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

      // Add a self-check read immediately after writing
      const selfCheckData = await this.redisClient.hGetAll(poppedQueueDetailsKey);
      GlobalEmitter.emit('queue_event', {
        type: 'internal_queue_picking_initiated', // Changed type
        queueId: queueId,
        data: { status: 'picking', captain1: captain1, captain2: captain2, allPlayers: players, originalOwnerSteamId: originalOwnerSteamId, capacity: capacity }
      });

      // Initialize Veto Process
        const vetoInitiatorSteamId = captain2; // Captain 2 starts map veto
        const initialVetoDetails: VetoDetails = {
          queueId: queueId,
          mapPool: DEFAULT_MAP_POOL,
          availableMapsToBan: [...DEFAULT_MAP_POOL],
          bansTeam1: [],
          bansTeam2: [],
          captain1SteamId: captain1,
          captain2SteamId: captain2,
          vetoInitiatorSteamId: vetoInitiatorSteamId,
          nextVetoerSteamId: vetoInitiatorSteamId,
          originalOwnerSteamId: originalOwnerSteamId,
          vetoBanOrder: [
            { captainSteamId: captain2, bansToMake: 2 },
            { captainSteamId: captain1, bansToMake: 3 },
            { captainSteamId: captain2, bansToMake: 1 }
          ],
          currentVetoStageIndex: 0,
          bansMadeThisStage: 0,
          pickedMap: null,
          status: 'awaiting_captain_start',
          log: [{ timestamp: Date.now(), actor: 'system', action: 'info', message: `Veto initialized. ${captain2} (Captain 2) to ban first.` }]
          // serverIp will be added later
        };
        await this._saveVetoDetails(queueId, initialVetoDetails);

    } catch (error) {
      console.error(`Error popping queue ${queueId}:`, error);
      try {
        await this.redisClient.hSet(`queue:${queueId}`, 'status', 'error_popping');
        GlobalEmitter.emit('queue_event', { type: 'queue_status_changed', queueId: queueId, data: { status: 'error_popping' } });
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

      const pickPhaseStateForReturn: PickPhaseState = {
        captain1, team1Name, team1Picks, captain2, team2Name, team2Picks,
        availablePlayers, nextPicker, picksMade, capacity, totalPlayersToPick,
        status: 'picking', // Status remains 'picking' until map veto and server allocation complete
        serverIp: null // Server IP will be set after map veto
      };
      if (picksMade >= totalPlayersToPick || availablePlayers.length === 0) {
        pickPhaseStateForReturn.nextPicker = "picking_complete";
        nextPicker = "picking_complete"; // Update local nextPicker for saving to Redis

        // Validate original_owner_steam_id from popped details before creating VetoDetails
        const ownerIdFromPoppedDetails = details.original_owner_steam_id;
        if (!ownerIdFromPoppedDetails) {
          console.error(`Critical: original_owner_steam_id is missing in popped_queue details for queue ${queueId}. Cannot initialize veto.`);
          return { state: null, error: 'Internal server error: Missing critical queue ownership data required for map veto initialization.', status: 500 };
        }

        // Emit event indicating teams are finalized and map veto is next.
        // No server IP or final queue status change here yet.
        GlobalEmitter.emit('queue_event', { type: 'teams_finalized', queueId: queueId, data: { ...pickPhaseStateForReturn, nextStep: 'map_veto' } });

        // No direct status change to in_progress_server_assigned or error_server_allocation_failed here.
        // No hSet on mainQueueKey for status or server_ip here.
        // No hSet on poppedQueueDetailsKey for server_ip here.
        pickPhaseStateForReturn.status = 'veto'; // Indicate that the next phase is veto for the pickPhaseState return

      } else {
        pickPhaseStateForReturn.nextPicker = (requestingUserSteamId === captain1) ? captain2 : captain1;
        nextPicker = pickPhaseStateForReturn.nextPicker; // Update local nextPicker for saving
        pickPhaseStateForReturn.status = 'picking'; // Status remains picking
      }

      await this.redisClient.hSet(poppedQueueDetailsKey, {
        available_players: JSON.stringify(availablePlayers),
        team1_picks: JSON.stringify(team1Picks),
        team2_picks: JSON.stringify(team2Picks),
        next_picker: nextPicker,
        picks_made: picksMade.toString()
      });

      GlobalEmitter.emit('queue_event', { type: 'player_picked', queueId: queueId, data: pickPhaseStateForReturn });
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
        const members = await this.redisClient.sMembers(queueMembersKey);
        GlobalEmitter.emit('queue_event', { type: 'player_left', queueId: queueId, data: { playerSteamId: playerSteamId, members: members } });
        return true;
      } else {
        console.debug(`Player ${playerSteamId} not found in queue ${queueId}.`);
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
        server_ip: queueData.server_ip,
        picked_map: queueData.picked_map
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

  async deleteQueue(queueId: string, requestingUserSteamId: string, canDelete: boolean | number): Promise<boolean> {
    try {
      const queueKey = `queue:${queueId}`;
      const ownerSteamId = await this.redisClient.hGet(queueKey, "ownerSteamId");
      if (!ownerSteamId) {
        console.warn(`Queue ${queueId} not found for deletion attempt by ${requestingUserSteamId}.`);
        return false;
      }
      if (!canDelete) {
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
      GlobalEmitter.emit('queue_event', { type: 'queue_deleted', queueId: queueId, data: { deletedBy: requestingUserSteamId } });
      return true;
    } catch (error) {
      console.error(`Error deleting queue ${queueId} by user ${requestingUserSteamId}:`, error);
      return false;
    }
  }

  private async _saveVetoDetails(queueId: string, vetoDetails: VetoDetails): Promise<void> {
    const vetoKey = `veto:${queueId}:details`;
    const detailsToSave: Record<string, string> = {
      queueId: vetoDetails.queueId,
      mapPool: JSON.stringify(vetoDetails.mapPool),
      availableMapsToBan: JSON.stringify(vetoDetails.availableMapsToBan),
      bansTeam1: JSON.stringify(vetoDetails.bansTeam1),
      bansTeam2: JSON.stringify(vetoDetails.bansTeam2),
      captain1SteamId: vetoDetails.captain1SteamId,
      captain2SteamId: vetoDetails.captain2SteamId,
      vetoInitiatorSteamId: vetoDetails.vetoInitiatorSteamId,
      originalOwnerSteamId: vetoDetails.originalOwnerSteamId, // Save originalOwnerSteamId
      nextVetoerSteamId: vetoDetails.nextVetoerSteamId || '',
      vetoBanOrder: JSON.stringify(vetoDetails.vetoBanOrder),
      currentVetoStageIndex: vetoDetails.currentVetoStageIndex.toString(),
      bansMadeThisStage: vetoDetails.bansMadeThisStage.toString(),
      pickedMap: vetoDetails.pickedMap || '',
      status: vetoDetails.status,
      log: JSON.stringify(vetoDetails.log),
      serverIp: vetoDetails.serverIp || '', // Save serverIp
    };
    await this.redisClient.hSet(vetoKey, detailsToSave);
    // TODO - Save veto results to local match table as well once match is created.
  }

  private _parseVetoDetails(redisData: Record<string, string>): VetoDetails | null {
    if (!redisData || Object.keys(redisData).length === 0) return null;
    try {
      return {
        queueId: redisData.queueId,
        mapPool: JSON.parse(redisData.mapPool || '[]'),
        availableMapsToBan: JSON.parse(redisData.availableMapsToBan || '[]'),
        bansTeam1: JSON.parse(redisData.bansTeam1 || '[]'),
        bansTeam2: JSON.parse(redisData.bansTeam2 || '[]'),
        captain1SteamId: redisData.captain1SteamId,
        captain2SteamId: redisData.captain2SteamId,
        vetoInitiatorSteamId: redisData.vetoInitiatorSteamId,
        originalOwnerSteamId: redisData.originalOwnerSteamId, // Parse originalOwnerSteamId
        nextVetoerSteamId: redisData.nextVetoerSteamId === '' ? null : redisData.nextVetoerSteamId,
        vetoBanOrder: JSON.parse(redisData.vetoBanOrder || '[]'),
        currentVetoStageIndex: parseInt(redisData.currentVetoStageIndex, 10),
        bansMadeThisStage: parseInt(redisData.bansMadeThisStage, 10),
        pickedMap: redisData.pickedMap === '' ? null : redisData.pickedMap,
        status: redisData.status as VetoDetails['status'],
        log: JSON.parse(redisData.log || '[]'),
        serverIp: redisData.serverIp === '' ? undefined : redisData.serverIp // Parse serverIp
      };
    } catch (error) {
      console.error(`Error parsing VetoDetails for queue ${redisData.queueId}:`, error);
      return null;
    }
  }

  async getVetoDetails(queueId: string): Promise<VetoDetails | null> {
    const vetoKey = `veto:${queueId}:details`;
    try {
      const redisData = await this.redisClient.hGetAll(vetoKey);
      if (!redisData || Object.keys(redisData).length === 0) {
        return null;
      }
      return this._parseVetoDetails(redisData);
    } catch (error) {
      console.error(`Error fetching veto details for queue ${queueId}:`, error);
      return null;
    }
  }

  async startVeto(queueId: string, requestingUserSteamId: string): Promise<{ success: boolean, message: string, status?: number, vetoDetails?: VetoDetails }> {
    try {
      const vetoDetails = await this.getVetoDetails(queueId);
      if (!vetoDetails) {
        return { success: false, message: 'Veto details not found for this queue.', status: 404 };
      }
      if (requestingUserSteamId !== vetoDetails.captain1SteamId && requestingUserSteamId !== vetoDetails.captain2SteamId) {
        return { success: false, message: 'Forbidden: Only captains can start the veto.', status: 403 };
      }

      if (vetoDetails.status !== 'awaiting_captain_start') {
        return { success: false, message: `Veto cannot be started. Current status: ${vetoDetails.status}.`, status: 409 };
      }

      vetoDetails.status = 'in_progress';
      vetoDetails.log.push({ timestamp: Date.now(), actor: requestingUserSteamId, action: 'info', message: 'Veto process started.' });

      await this._saveVetoDetails(queueId, vetoDetails);
      GlobalEmitter.emit('queue_event', { type: 'veto_started', queueId: queueId, data: vetoDetails });

      return { success: true, message: 'Veto process started successfully.', vetoDetails: vetoDetails };

    } catch (error) {
      console.error(`Error starting veto for queue ${queueId} by user ${requestingUserSteamId}:`, error);
      return { success: false, message: 'Server error starting veto process.', status: 500 };
    }
  }

  async recordMapBan(queueId: string, captainSteamId: string, mapName: string): Promise<{ success: boolean, message: string, status?: number, vetoDetails?: VetoDetails }> {
    try {
      let vetoDetails = await this.getVetoDetails(queueId);
      if (!vetoDetails) {
        return { success: false, message: 'Veto details not found for this queue.', status: 404 };
      }

      if (vetoDetails.status !== 'in_progress') {
        return { success: false, message: `Map cannot be banned. Veto status is: ${vetoDetails.status}.`, status: 409 };
      }

      if (vetoDetails.nextVetoerSteamId !== captainSteamId) {
        return { success: false, message: 'Forbidden: It is not your turn to ban a map.', status: 403 };
      }

      if (!vetoDetails.availableMapsToBan.includes(mapName)) {
        return { success: false, message: `Map '${mapName}' is not available for banning.`, status: 400 };
      }

      // Record the ban
      if (captainSteamId === vetoDetails.captain1SteamId) {
        vetoDetails.bansTeam1.push(mapName);
      } else {
        vetoDetails.bansTeam2.push(mapName);
      }
      vetoDetails.availableMapsToBan = vetoDetails.availableMapsToBan.filter(m => m !== mapName);
      vetoDetails.bansMadeThisStage++;
      vetoDetails.log.push({ timestamp: Date.now(), actor: captainSteamId, action: 'ban', map: mapName, message: `banned ${mapName}.` });

      // Veto Logic
      const currentStage = vetoDetails.vetoBanOrder[vetoDetails.currentVetoStageIndex];
      if (vetoDetails.bansMadeThisStage < currentStage.bansToMake) {
        // Current stage continues, nextVetoerSteamId remains the same
      } else {
        // Current stage's bans are complete
        vetoDetails.currentVetoStageIndex++;
        vetoDetails.bansMadeThisStage = 0;

        if (vetoDetails.currentVetoStageIndex < vetoDetails.vetoBanOrder.length) {
          // More ban stages left
          vetoDetails.nextVetoerSteamId = vetoDetails.vetoBanOrder[vetoDetails.currentVetoStageIndex].captainSteamId;
        } else {
          // All ban stages complete
          vetoDetails.status = 'completed';
          vetoDetails.nextVetoerSteamId = null; // Veto complete
          if (vetoDetails.availableMapsToBan.length === 1) {
            vetoDetails.pickedMap = vetoDetails.availableMapsToBan[0];
            vetoDetails.log.push({ timestamp: Date.now(), actor: 'system', action: 'pick', map: vetoDetails.pickedMap, message: `Map automatically picked: ${vetoDetails.pickedMap}.` });

            // Server Allocation Logic
            let serverIp: string | null = null;
            const ownerForServerSearch = vetoDetails.originalOwnerSteamId || vetoDetails.captain1SteamId; // Fallback if originalOwnerSteamId is missing

            serverIp = await this._findUserServer(ownerForServerSearch, queueId, vetoDetails.pickedMap);
            if (!serverIp) {
              serverIp = await this._findPublicServer(queueId, vetoDetails.pickedMap);
            }
            if (!serverIp) {
              serverIp = await this._setupDockerizedServer(queueId, vetoDetails.pickedMap);
            }

            let finalQueueStatus: Queue['status'];
            const mainQueueKey = `queue:${queueId}`;
            if (serverIp) {
              finalQueueStatus = 'in_progress_server_assigned';
              vetoDetails.serverIp = serverIp;
              await this.redisClient.hSet(mainQueueKey, { status: finalQueueStatus, server_ip: serverIp, picked_map: vetoDetails.pickedMap });
              vetoDetails.log.push({ timestamp: Date.now(), actor: 'system', action: 'info', serverIp: serverIp, message: `Server allocated: ${serverIp} for map ${vetoDetails.pickedMap}.` });
            } else {
              finalQueueStatus = 'error_server_allocation_failed';
              await this.redisClient.hSet(mainQueueKey, { status: finalQueueStatus, picked_map: vetoDetails.pickedMap });
              vetoDetails.log.push({ timestamp: Date.now(), actor: 'system', action: 'info', message: `Server allocation failed for map ${vetoDetails.pickedMap}.` });
            }

            await this._saveVetoDetails(queueId, vetoDetails); // Save VetoDetails with serverIp and log

            GlobalEmitter.emit('queue_event', { type: 'map_picked', queueId: queueId, data: { pickedMap: vetoDetails.pickedMap, serverIp: vetoDetails.serverIp, status: finalQueueStatus, vetoDetails: vetoDetails } });
            GlobalEmitter.emit('queue_event', { type: 'queue_status_changed', queueId: queueId, data: { status: finalQueueStatus, serverIp: vetoDetails.serverIp, pickedMap: vetoDetails.pickedMap } });

          } else {
            console.warn(`Veto completed for queue ${queueId}, but ${vetoDetails.availableMapsToBan.length} maps remain. Expected 1.`);
            vetoDetails.log.push({ timestamp: Date.now(), actor: 'system', action: 'info', message: `Veto completed. ${vetoDetails.availableMapsToBan.length} maps remain. Manual pick may be required.` });
            // No server allocation if map isn't uniquely determined
          }
        }
      }

      await this._saveVetoDetails(queueId, vetoDetails); // Save intermediate veto progress
      GlobalEmitter.emit('queue_event', { type: 'map_banned', queueId: queueId, data: { bannedBy: captainSteamId, mapName: mapName, vetoDetails: vetoDetails } });

      return { success: true, message: `Map '${mapName}' banned successfully.`, vetoDetails: vetoDetails };

    } catch (error) {
      console.error(`Error recording map ban for queue ${queueId} by captain ${captainSteamId}:`, error);
      return { success: false, message: 'Server error recording map ban.', status: 500 };
    }
  }


  async disconnect(): Promise<void> {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.disconnect();
    }
  }
}

export default QueueService;