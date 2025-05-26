import config from "config";
import { Router, Request, Response } from 'express';
import passport from 'passport'; // For req.user, if needed, but Utils.ensureAuthenticated handles session
import QueueService from '../../services/queueservice.js';
import Utils from '../../utility/utils.js';
import { User as CustomUser } from '../../types/User.js'; // Renamed to avoid conflict with Express.User
import { Queue } from '../../types/queues/Queue.js'; // Updated import path for Queue interface

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
 *           enum: [waiting, popped, picking, in_progress, completed, error_popping, error_not_enough_players_for_captains]
 *         members:
 *           type: array
 *           items:
 *             type: string
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
 *       500:
 *         description: Server error
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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Queue not found or player not in queue
 *       500:
 *         description: Server error
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
 *         description: Queue created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Queue'
 *       400:
 *         description: Invalid request or user queue limit reached
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error creating queue
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
 *         description: Player picked successfully. Returns the current state of the picking phase.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PickPhaseState'
 *       400:
 *         description: Bad request (e.g., player not available, queue not in picking phase).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (e.g., not a captain, not your turn).
 *       404:
 *         description: Queue not found or not in picking state.
 *       500:
 *         description: Server error.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not owner or super admin)
 *       404:
 *         description: Queue not found
 *       500:
 *         description: Server error
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
        const isAdmin = Utils.superAdminCheck(user);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this queue.' });
        }

        const success = await queueService.deleteQueue(queueId, requestingUserSteamId);
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
 * /queues/{queueId}/events:
 *   get:
 *     summary: Subscribe to real-time queue events (SSE)
 *     tags: [Queues]
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

        const heartbeatInterval = setInterval(() => {
            res.write(':heartbeat\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(heartbeatInterval);
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

export default router;
