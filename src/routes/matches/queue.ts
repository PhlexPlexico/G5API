import config from "config";
import { Router, Request, Response } from 'express';
import QueueService from '../../services/queueservice.js';
import Utils from '../../utility/utils.js';
import { User as CustomUser } from '../../types/User.js'; // Renamed to avoid conflict with Express.User

/**
 * @swagger
 * components:
 *   schemas:
 *     Queue:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         ownerSteamId:
 *           type: string
 *         capacity:
 *           type: integer
 *         createdAt:
 *           type: number
 *         status:
 *           type: string
 *           enum: [waiting, popped, picking, veto, in_progress, in_progress_server_assigned, pending_server_manual, error_server_allocation_failed, completed, error_popping, error_not_enough_players_for_captains]
 *           description: The current status of the queue.
 *         members:
 *           type: array
 *           items:
 *             type: string
 *           description: List of Steam IDs of players currently in the queue.
 *         server_ip:
 *           type: string
 *           nullable: true
 *           description: IP and port of the game server if assigned.
 *         picked_map:
 *           type: string
 *           nullable: true
 *           description: The map that was picked in the veto phase, if applicable.
 *     PickPhaseState:
 *       type: object
 *       properties:
 *         captain1:
 *           type: string
 *         team1Name:
 *           type: string
 *         team1Picks:
 *           type: array
 *           items:
 *             type: string
 *         captain2:
 *           type: string
 *         team2Name:
 *           type: string
 *         team2Picks:
 *           type: array
 *           items:
 *             type: string
 *         availablePlayers:
 *           type: array
 *           items:
 *             type: string
 *         nextPicker:
 *           type: string
 *           description: Steam ID of the next captain to pick, or "picking_complete".
 *         picksMade:
 *           type: integer
 *         capacity:
 *           type: integer
 *         totalPlayersToPick:
 *           type: integer
 *         status:
 *           type: string
 *           description: Current status of the pick phase (e.g., 'picking', 'veto', 'in_progress_server_assigned').
 *           example: 'picking'
 *         serverIp:
 *           type: string
 *           nullable: true
 *           description: Server IP if assigned after picking/veto.
 *         nextStep:
 *           type: string
 *           nullable: true
 *           description: Indicates the next logical step after team finalization (e.g., 'map_veto').
 *           example: 'map_veto'
 *     VetoDetails:
 *       type: object
 *       properties:
 *         queueId:
 *           type: string
 *           description: The ID of the queue this veto pertains to.
 *         mapPool:
 *           type: array
 *           items:
 *             type: string
 *           description: The initial list of maps available for this veto.
 *           example: ["de_dust2", "de_mirage", "de_inferno"]
 *         availableMapsToBan:
 *           type: array
 *           items:
 *             type: string
 *           description: Maps currently available for banning.
 *         bansTeam1:
 *           type: array
 *           items:
 *             type: string
 *           description: Maps banned by Captain 1.
 *         bansTeam2:
 *           type: array
 *           items:
 *             type: string
 *           description: Maps banned by Captain 2.
 *         captain1SteamId:
 *           type: string
 *         captain2SteamId:
 *           type: string
 *         vetoInitiatorSteamId:
 *           type: string
 *           description: Steam ID of the captain who makes the first ban(s).
 *         originalOwnerSteamId:
 *            type: string
 *            description: Steam ID of the original queue owner, used for server allocation preferences.
 *         nextVetoerSteamId:
 *           type: string
 *           nullable: true
 *           description: Steam ID of the captain whose turn it is to ban/pick. Null if veto is not started or completed.
 *         vetoBanOrder:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               captainSteamId:
 *                 type: string
 *               bansToMake:
 *                 type: integer
 *           description: Describes the sequence of bans/picks.
 *         currentVetoStageIndex:
 *           type: integer
 *           description: Index into the vetoBanOrder array indicating the current stage.
 *         bansMadeThisStage:
 *           type: integer
 *           description: Number of bans made in the current stage by the current vetoer.
 *         pickedMap:
 *           type: string
 *           nullable: true
 *           description: The map selected after the veto process is complete.
 *         status:
 *           type: string
 *           enum: [not_started, awaiting_captain_start, in_progress, completed, error]
 *           description: The current status of the map veto process.
 *         log:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               timestamp:
 *                 type: number
 *               actor:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [ban, pick, info]
 *               map:
 *                 type: string
 *                 nullable: true
 *               message:
 *                 type: string
 *           description: Log of veto actions.
 *         serverIp:
 *           type: string
 *           nullable: true
 *           description: Server IP assigned after the veto is completed and map is picked.
 *   securitySchemes:
 *     bearerAuth: 
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT 
 *     cookieAuth: 
 *       type: apiKey
 *       in: cookie
 *       name: connect.sid 
 */

const router = Router();
// It's better to pass redisUrl from config, or let QueueService handle it internally if it can access config
const queueService = new QueueService(config.get("server.redisUrl") || '');

// Placeholder for event emitter if needed for SSE.
// For now, SSE is handled with a simple heartbeat.
// import { EventEmitter } from 'events';
// const queueEvents = new EventEmitter();

/**
 * @swagger
 * tags:
 *   name: Queues
 *   description: Queue management
 */

/**
 * @swagger
 * /queues:
 *   get:
 *     summary: List all available queues
 *     tags: [Queues]
 *     responses:
 *       200:
 *         description: A list of all active queues
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Queue'
 *       500:
 *         description: Server error
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const queues = await queueService.listAllQueues();
        res.status(200).json(queues);
    } catch (error) {
        console.error('Error listing all queues:', error);
        res.status(500).json({ message: 'Server error listing queues.' });
    }
});

/**
 * @swagger
 * /queues/myqueues:
 *   get:
 *     summary: List queues owned by the authenticated user
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of the user's queues
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Queue'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/myqueues', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const steamId = user.steam_id;
        const queues = await queueService.listUserQueues(steamId);
        res.status(200).json(queues);
    } catch (error) {
        console.error('Error listing user queues:', error);
        res.status(500).json({ message: 'Server error listing user queues.' });
    }
});

/**
 * @swagger
 * /queues/{queueId}:
 *   get:
 *     summary: Get details of a specific queue
 *     tags: [Queues]
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue
 *     responses:
 *       200:
 *         description: Queue details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Queue'
 *       404:
 *         description: Queue not found
 *       500:
 *         description: Server error
 */
router.get('/:queueId', async (req: Request, res: Response) => {
    try {
        const { queueId } = req.params;
        const queue = await queueService.getQueueDetails(queueId);
        if (queue) {
            res.status(200).json(queue);
        } else {
            res.status(404).json({ message: 'Queue not found.' });
        }
    } catch (error) {
        console.error(`Error getting queue details for ${req.params.queueId}:`, error);
        res.status(500).json({ message: 'Server error getting queue details.' });
    }
});

/**
 * @swagger
 * /queues/{queueId}/join:
 *   put:
 *     summary: Join a queue
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue to join
 *     responses:
 *       200:
 *         description: Successfully joined the queue
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Queue not found
 *       409:
 *         description: Queue is full or player already in queue, or queue not in 'waiting' state.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue is full."
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error joining queue."
 */
router.put('/:queueId/join', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const steamId = user.steam_id;
        const { queueId } = req.params;

        const result = await queueService.addPlayerToQueue(queueId, steamId);
        if (result) {
            res.status(200).json({ message: 'Successfully joined the queue.' });
        } else {
            const queueDetails = await queueService.getQueueDetails(queueId);
            if (!queueDetails) {
                return res.status(404).json({ message: 'Queue not found.' });
            }
            if (queueDetails.status !== 'waiting') {
                return res.status(409).json({ message: `Queue is not in 'waiting' state (current state: ${queueDetails.status}).` });
            }
            if (queueDetails.members.length >= queueDetails.capacity) {
                return res.status(409).json({ message: 'Queue is full.' });
            }
            // Default to a generic conflict if specific conditions above not met
            return res.status(409).json({ message: 'Failed to join queue. It might be full, you are already in it, or an unknown issue occurred.' });
        }
    } catch (error) {
        console.error(`Error joining queue ${req.params.queueId}:`, error);
        res.status(500).json({ message: 'Server error joining queue.' });
    }
});

/**
 * @swagger
 * /queues/{queueId}/leave:
 *   put:
 *     summary: Leave a queue
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue to leave
 *     responses:
 *       200:
 *         description: Successfully left the queue
 *       400:
 *         description: Owner cannot leave as the last member, or player cannot leave a queue in its current state.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Owner cannot leave the queue as the last member. Please delete the queue instead."
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Queue not found or player not in queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue not found or player not in queue."
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error leaving queue."
 */
router.put('/:queueId/leave', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const steamId = user.steam_id;
        const { queueId } = req.params;

        const result = await queueService.removePlayerFromQueue(queueId, steamId);
        if (result) {
            res.status(200).json({ message: 'Successfully left the queue.' });
        } else {
            const queue = await queueService.getQueueDetails(queueId);
            if (!queue) {
                return res.status(404).json({ message: 'Queue not found or player not in queue.' });
            }
            if (queue.ownerSteamId === steamId && queue.members.length === 1) {
                return res.status(400).json({ message: 'Owner cannot leave the queue as the last member. Please delete the queue instead.' });
            }
            if (['picking', 'in_progress', 'completed'].includes(queue.status)) {
                return res.status(400).json({ message: `Cannot leave queue while it is in '${queue.status}' state.` });
            }
            return res.status(404).json({ message: 'Failed to leave queue. Player not found in queue or other reason.' });
        }
    } catch (error) {
        console.error(`Error leaving queue ${req.params.queueId}:`, error);
        res.status(500).json({ message: 'Server error leaving queue.' });
    }
});


/**
 * @swagger
 * /queues:
 *   post:
 *     summary: Create a new queue
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: [] 
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               capacity:
 *                 type: integer
 *                 description: Optional capacity for the queue. Defaults to server setting.
 *                 example: 10
 *     responses:
 *       201:
 *         description: Queue created successfully. The owner is automatically added as the first member.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Queue'
 *       400:
 *         description: Invalid request (e.g. invalid capacity) or user queue limit reached.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to create queue. User limit may be reached or invalid parameters."
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error creating queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error creating queue."
 */
router.post('/', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const steamId = user.steam_id;
        const { capacity } = req.body[0]?.capacity;

        const newQueue = await queueService.createQueue(steamId, capacity);
        if (newQueue) {
            res.status(201).json(newQueue);
        } else {
            res.status(400).json({ message: 'Failed to create queue. User limit may be reached or invalid parameters.' });
        }
    } catch (error) {
        console.error('Error creating queue:', error);
        res.status(500).json({ message: 'Server error creating queue.' });
    }
});

/**
 * @swagger
 * /queues/{queueId}/pick:
 *   post:
 *     summary: Pick a player for a team in a queue
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue in picking phase
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerSteamId
 *             properties:
 *               playerSteamId:
 *                 type: string
 *                 description: The Steam ID of the player to pick.
 *     responses:
 *       200:
 *         description: Player picked successfully. Returns the current state of the picking phase. If this is the last pick, teams are finalized, and the system may proceed to map veto.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Player picked successfully"
 *                 data:
 *                   $ref: '#/components/schemas/PickPhaseState'
 *       400:
 *         description: Bad request (e.g., playerSteamId missing, player not available, queue not in picking phase).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Player not available or already picked."
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (e.g., not a captain, not your turn to pick).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden: It is not your turn to pick."
 *       404:
 *         description: Queue not found or not in picking state.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue not found or not in picking state."
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error during player pick."
 */
router.post('/:queueId/pick', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const requestingUserSteamId = user.steam_id;
        const { queueId } = req.params;
        const { playerSteamId: playerToPickSteamId } = req.body;

        if (!playerToPickSteamId) {
            return res.status(400).json({ message: 'playerSteamId is required in the request body.' });
        }

        const result = await queueService.pickPlayerInQueue(queueId, requestingUserSteamId, playerToPickSteamId);

        if (result.error) {
            return res.status(result.status || 500).json({ message: result.error });
        }

        res.status(200).json({ message: "Player picked successfully", data: result.state });

    } catch (error) {
        console.error(`Error picking player for queue ${req.params.queueId}:`, error);
        // Check if error has a status property, otherwise default to 500
        const status = (error as any).status || 500;
        const message = (error as any).message || 'Server error during player pick.';
        res.status(status).json({ message });
    }
});


/**
 * @swagger
 * /queues/{queueId}:
 *   delete:
 *     summary: Delete a queue
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue to delete
 *     responses:
 *       200:
 *         description: Queue deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue deleted successfully."
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not the owner or an admin/super_admin with rights to delete).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden: You do not have permission to delete this queue."
 *       404:
 *         description: Queue not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue not found."
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error deleting queue."
 */
router.delete('/:queueId', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const requestingUserSteamId = user.steam_id;
        const { queueId } = req.params;

        const queue = await queueService.getQueueDetails(queueId);
        if (!queue) {
            return res.status(404).json({ message: 'Queue not found.' });
        }

        const isOwner = queue.ownerSteamId === requestingUserSteamId;
        const canDelete = isOwner || user.admin || user.super_admin;

        if (!canDelete) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this queue.' });
        }

        const success = await queueService.deleteQueue(queueId, requestingUserSteamId, canDelete);
        if (success) {
            res.status(200).json({ message: 'Queue deleted successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to delete queue due to a server issue or race condition.' });
        }
    } catch (error) {
        console.error(`Error deleting queue ${req.params.queueId}:`, error);
        res.status(500).json({ message: 'Server error deleting queue.' });
    }
});

/**
 * @swagger
 * /queues/{queueId}:
 *   put:
 *     summary: Update a queue's capacity
 *     tags: [Queues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - capacity
 *             properties:
 *               capacity:
 *                 type: integer
 *                 description: The new capacity for the queue.
 *                 example: 12
 *     responses:
 *       200:
 *         description: Queue capacity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue capacity updated successfully."
 *       400:
 *         description: Bad Request (e.g., invalid capacity format - must be a positive integer).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Capacity must be a positive integer."
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (user is not the owner or an admin/super_admin).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden: You do not have permission to update this queue."
 *       404:
 *         description: Queue not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue not found."
 *       409:
 *         description: Conflict (e.g., queue not in 'waiting' state, or new capacity less than current member count).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue capacity can only be updated if in 'waiting' state. Current state: picking"
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error updating queue capacity."
 */
router.put('/:queueId', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const requestingUserSteamId = user.steam_id;
        const { queueId } = req.params;
        const { capacity: newCapacity } = req.body;

        if (typeof newCapacity !== 'number' || !Number.isInteger(newCapacity) || newCapacity <= 0) {
            return res.status(400).json({ message: 'Capacity must be a positive integer.' });
        }

        const queue = await queueService.getQueueDetails(queueId);
        if (!queue) {
            return res.status(404).json({ message: 'Queue not found.' });
        }

        const isOwner = queue.ownerSteamId === requestingUserSteamId;
        const canUpdate = isOwner || user.admin || user.super_admin;

        if (!canUpdate) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to update this queue.' });
        }

        // QueueService.updateQueueCapacity will handle 'waiting' state check and capacity vs members.
        const result = await queueService.updateQueueCapacity(queueId, newCapacity);

        if (result.success) {
            res.status(200).json({ message: result.message || 'Queue capacity updated successfully.' });
        } else {
            res.status(result.status || 500).json({ message: result.message || 'Failed to update queue capacity.' });
        }
    } catch (error) {
        console.error(`Error updating queue capacity for ${req.params.queueId}:`, error);
        // Check if error has a status property, otherwise default to 500
        const status = (error as any).status || 500;
        const message = (error as any).message || 'Server error updating queue capacity.';
        res.status(status).json({ message });
    }
});

/**
 * @swagger
 * /queues/{queueId}/events:
 *   get:
 *     summary: Subscribe to real-time queue events for a specific queue (SSE).
 *     description: Provides real-time updates for the queue, including player joins/leaves, status changes (e.g., popped, picking, veto, in_progress), team picks, map veto progress (veto_started, map_banned, map_picked), and server assignment. Clients receive events relevant to the specified queueId.
 *     tags: [Queues, SSE]
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue to subscribe to
 *     responses:
 *       200:
 *         description: Event stream established.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       404:
 *         description: Queue not found
 */
// Existing GET /:queueId/events route
router.get('/:queueId/events', async (req: Request, res: Response) => {
    const { queueId } = req.params;

    try {
        const queue = await queueService.getQueueDetails(queueId);
        if (!queue) {
            res.status(404).json({ message: "Queue not found" });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        res.write('event: connected\ndata: You are connected to queue events.\n\n');

        const emitter = queueService.getEventsEmitter();

        const queueEventListener = (eventDetails: any) => {
            if (eventDetails.queueId === queueId) {
                res.write(`event: ${eventDetails.type}\ndata: ${JSON.stringify(eventDetails.data)}\n\n`);
            }
        };

        emitter.on('queue_event', queueEventListener);

        const heartbeatInterval = setInterval(() => {
            res.write(':heartbeat\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(heartbeatInterval);
            emitter.off('queue_event', queueEventListener);
            res.end();
            console.log(`SSE connection closed for queue ${queueId}`);
        });

    } catch (error) {
        console.error(`Error setting up SSE for queue ${queueId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error setting up SSE.' });
        } else {
            res.end();
        }
    }
});


/**
 * @swagger
 * /queues/{queueId}/veto:
 *   get:
 *     summary: Get the current map veto details for a queue
 *     tags: [Queues, Veto]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue
 *     responses:
 *       200:
 *         description: Veto details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VetoDetails'
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Veto details not found for this queue.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Veto details not found for this queue."
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error getting veto details."
 */
router.get('/:queueId/veto', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const { queueId } = req.params;
        const vetoDetails = await queueService.getVetoDetails(queueId);

        if (!vetoDetails) {
            return res.status(404).json({ message: 'Veto details not found for this queue.' });
        }
        res.status(200).json(vetoDetails);
    } catch (error) {
        console.error(`Error getting veto details for queue ${req.params.queueId}:`, error);
        res.status(500).json({ message: 'Server error getting veto details.' });
    }
});

/**
 * @swagger
 * /queues/{queueId}/veto/start:
 *   post:
 *     summary: Start the map veto process for a queue
 *     tags: [Queues, Veto]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue where the veto will start
 *     responses:
 *       200:
 *         description: Veto process started successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 vetoDetails:
 *                   $ref: '#/components/schemas/VetoDetails'
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (e.g., not a captain, or veto cannot be started by this user).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden: Only captains can start the veto."
 *       404:
 *         description: Veto details not found or queue not ready for veto.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Veto details not found for this queue."
 *       409:
 *         description: Conflict (e.g., veto already started or in an invalid state).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Veto cannot be started. Current status: in_progress."
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error starting veto."
 */
router.post('/:queueId/veto/start', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const requestingUserSteamId = user.steam_id;
        const { queueId } = req.params;

        const result = await queueService.startVeto(queueId, requestingUserSteamId);

        if (result.success) {
            res.status(200).json({ message: result.message, vetoDetails: result.vetoDetails });
        } else {
            res.status(result.status || 500).json({ message: result.message });
        }
    } catch (error) {
        console.error(`Error starting veto for queue ${req.params.queueId}:`, error);
        const status = (error as any).status || 500;
        const message = (error as any).message || 'Server error starting veto.';
        res.status(status).json({ message });
    }
});

/**
 * @swagger
 * /queues/{queueId}/veto/ban:
 *   post:
 *     summary: Record a map ban during the veto process
 *     tags: [Queues, Veto]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the queue for the veto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mapName
 *             properties:
 *               mapName:
 *                 type: string
 *                 description: The name of the map to ban (e.g., "de_dust2").
 *                 example: "de_dust2"
 *     responses:
 *       200:
 *         description: Map banned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 vetoDetails:
 *                   $ref: '#/components/schemas/VetoDetails'
 *       400:
 *         description: Bad Request (e.g., mapName not provided, or map not available for banning).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Map 'de_nonexistent' is not available for banning."
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (e.g., not user's turn to ban).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden: It is not your turn to ban a map."
 *       404:
 *         description: Veto details not found or queue not in veto process.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Veto details not found for this queue."
 *       409:
 *         description: Conflict (e.g., veto not in progress).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Map cannot be banned. Veto status is: completed."
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error banning map."
 */
router.post('/:queueId/veto/ban', Utils.ensureAuthenticated, async (req: Request, res: Response) => {
    try {
        const user = req.user as CustomUser;
        if (!user || !user.steam_id) {
            return res.status(401).json({ message: 'User not authenticated properly.' });
        }
        const captainSteamId = user.steam_id;
        const { queueId } = req.params;
        const { mapName } = req.body;

        if (!mapName || typeof mapName !== 'string') {
            return res.status(400).json({ message: 'mapName is required in the request body and must be a string.' });
        }

        const result = await queueService.recordMapBan(queueId, captainSteamId, mapName);

        if (result.success) {
            res.status(200).json({ message: result.message, vetoDetails: result.vetoDetails });
        } else {
            res.status(result.status || 500).json({ message: result.message });
        }
    } catch (error) {
        console.error(`Error banning map for queue ${req.params.queueId}:`, error);
        const status = (error as any).status || 500;
        const message = (error as any).message || 'Server error banning map.';
        res.status(status).json({ message });
    }
});


export default router;
