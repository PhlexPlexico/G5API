/**
 * @swagger
 * resourcePath: /queue
 * description: Express API router for queue management in G5API.
 */
import config from "config";
import { Router } from 'express';
import Utils from "../utility/utils.js";
import {
  QueueService,
  QueueOwnerDatHostConfigMissingError
} from "../services/queue.js";
import GlobalEmitter from "../utility/emitter.js";

const router = Router();
type QueueGame = "cs2" | "csgo";
const DEFAULT_QUEUE_GAME: QueueGame = "cs2";

const getRequesterRole = (req: any): string => {
  let role: string = 'user';
  if (req.user?.admin) role = 'admin';
  else if (req.user?.super_admin) role = 'super_admin';
  return role;
};

const buildQueueState = async (slug: string): Promise<any> => {
  try {
    const users = await QueueService.listUsersInQueue(slug);
    const queue = await QueueService.getQueue(slug, 'admin', '');
    return {
      slug,
      queue: {
        ...queue,
        currentPlayers: users.length,
      },
      users,
    };
  } catch (error: any) {
    if (
      error?.message?.includes('does not exist') ||
      error?.message?.includes('missing') ||
      error?.message?.includes('not found')
    ) {
      return { slug, queue: null, users: [] };
    }
    throw error;
  }
};


/**
 * @swagger
 *
 * components:
 *  schemas:
 *    QueueDescriptor:
 *      type: object
 *      properties:
 *        name:
 *          type: string
 *          description: Unique identifier for the queue
 *          example: "support-queue-abc123"
 *        createdAt:
 *          type: integer
 *          format: int64
 *          description: Timestamp (ms) when the queue was created
 *          example: 1699478400000
 *        expiresAt:
 *          type: integer
 *          format: int64
 *          description: Timestamp (ms) when the queue will expire
 *          example: 1699482000000
 *        ownerId:
 *          type: string
 *          nullable: true
 *          description: Optional user ID of the queue creator
 *          example: "user-456"
 *        maxSize:
 *          type: integer
 *          nullable: true
 *          description: Optional max number of users allowed
 *          example: 50
 *        isPrivate:
 *          type: boolean
 *          nullable: true
 *          description: Optional flag for visibility
 *          example: false
 *        game:
 *          type: string
 *          nullable: true
 *          enum: [cs2, csgo]
 *          description: Selected game for this queue.
 *          example: cs2
 *  responses:
 *    NoSeasonData:
 *      description: No season data was provided.
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/SimpleResponse'
 */


/**
 * @swagger
 *
 * /queue/:
 *   get:
 *     description: Get all available queues to the user from G5API.
 *     produces:
 *       - application/json
 *     tags:
 *       - queue
 *     responses:
 *       200:
 *         description: All queues available to the user in the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 seasons:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QueueDescriptor'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get('/', Utils.ensureAuthenticated, async (req, res) => {
  try {
    let role: string = 'user';
    if (req.user?.admin) role = 'admin';
    else if (req.user?.super_admin) role = 'super_admin';
    const queues = await QueueService.listQueues(req.user?.steam_id!, role);
    res.status(200).json(queues);
  } catch (error) {
    console.error('Error listing queues:', error);
    res.status(500).json({ error: 'Failed to list queues.' });
  }
});

/**
 * @swagger
 *
 * /queue/:slug:
 *   get:
 *     description: Get a specific queue by its slug.
 *     produces:
 *       - application/json
 *     tags:
 *       - queue
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: The slug identifier of the queue.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The requested queue descriptor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueDescriptor'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get('/:slug', async (req, res) => {
  const slug: string = req.params.slug;

  try {
    let role: string = 'user';
    if (req.user?.admin) role = 'admin';
    else if (req.user?.super_admin) role = 'super_admin';
    const queue = await QueueService.getQueue(slug, role, req.user?.steam_id!);
    res.status(200).json(queue);
  } catch (error: Error | any) {
    console.error('Error fetching queue:', error);
    if (error.message.includes('does not exist')) {
      return res.status(404).json({ error: 'Queue not found.' });
    }
    res.status(500).json({ error: 'Failed to fetch queue.' });
  }
});

/**
* @swagger
*
* /queue/:slug/stream:
*   get:
*     description: Stream queue state changes for join/leave and match creation events.
*     produces:
*       - text/event-stream
*     tags:
*       - queue
*     parameters:
*       - name: slug
*         in: path
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Queue state stream.
*       500:
*         $ref: '#/components/responses/Error'
*/
router.get('/:slug/stream', async (req, res) => {
  const slug: string = req.params.slug;
  try {
    res.set({
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    const writeState = async (matchEvent: any = null) => {
      const snapshot = await buildQueueState(slug);
      const payload = {
        ...snapshot,
        match: matchEvent?.matchId != null ? {
          id: matchEvent.matchId,
          serverId: matchEvent.serverId ?? null
        } : null
      };
      res.write(`event: queue_state\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const onQueueUpdate = async (event: any) => {
      if (!event || event.slug !== slug) return;
      await writeState(event.match ?? null);
    };

    GlobalEmitter.on("queueUpdate", onQueueUpdate);
    await writeState();

    req.on("close", () => {
      GlobalEmitter.removeListener("queueUpdate", onQueueUpdate);
      res.end();
    });
    req.on("disconnect", () => {
      GlobalEmitter.removeListener("queueUpdate", onQueueUpdate);
      res.end();
    });
  } catch (error) {
    console.error('Error streaming queue state:', error);
    res.status(500).write(`event: error\ndata: ${(error as Error).toString()}\n\n`);
    res.end();
  }
});

/**
 * @swagger
 *
 * /queue/:slug/players:
 *   get:
 *     description: List all users in a specific queue.
 *     produces:
 *       - application/json
 *     tags:
 *       - queue
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: The slug identifier of the queue.
 *         schema:
 *           type: string
 *       - name: role
 *         in: query
 *         required: false
 *         description: Role of the requester (default is "user").
 *         schema:
 *           type: string
 *           enum: [user, admin]
 *     responses:
 *       200:
 *         description: List of users in the queue.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/QueueItem'
 *       403:
 *         description: Permission denied.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You do not have permission to remove other users from this queue."
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get('/:slug/players', Utils.ensureAuthenticated, async (req, res) => {
  const slug: string = req.params.slug;
  const requestorSteamId = req.user?.steam_id;
  if (!requestorSteamId) {
    return res.status(401).json({ error: 'Unauthorized: Steam ID missing.' });
  }

  try {
    const users = await QueueService.listUsersInQueue(slug);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error listing users in queue:', error);
    res.status(500).json({ error: 'Failed to list users in queue.' });
  }
});

/**
 * @swagger
 *
 * /queue/:
 *   post:
 *     description: Create a new queue in G5API using the authenticated user's Steam ID.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     tags:
 *       - queue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 maxPlayers:
 *                   type: integer
 *                   description: Maximum number of players allowed in the queue
 *                   example: 10
 *                 private:
 *                   type: boolean
 *                   description: Whether the queue is private or will be listed publically.
 *                   example: false
 *                   required: false
 *                 game:
 *                   type: string
 *                   description: Game type for the queue.
 *                   enum: [cs2, csgo]
 *                   example: cs2
 *     responses:
 *       200:
 *         description: New season inserted successsfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleResponse'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.post('/', Utils.ensureAuthenticated, async (req, res) => {
  const payload = req.body?.[0] ?? {};
  const maxPlayers: number = Number(payload.maxPlayers);
  const isPrivate: boolean = payload.private ? true : false;
  const requestedGame = payload.game;

  if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) {
    return res.status(400).json({ error: "Invalid maxPlayers value." });
  }

  let game: QueueGame = DEFAULT_QUEUE_GAME;
  if (requestedGame != null) {
    if (requestedGame !== "cs2" && requestedGame !== "csgo") {
      return res.status(400).json({ error: 'Invalid game. Must be "cs2" or "csgo".' });
    }
    game = requestedGame;
  }

  try {
    const descriptor = await QueueService.createQueue(
      req.user?.steam_id!,
      req.user?.name!,
      maxPlayers,
      isPrivate,
      game
    );
    res.json({ message: "Queue created successfully!", url: `${config.get("server.apiURL")}/queue/${descriptor.name}` });
  } catch (error) {
    console.error('Error creating queue:', error);
    res.status(500).json({ error: 'Failed to create queue.' });
  }
});


/**
 * @swagger
 *
 * /queue/:slug:
 *   put:
 *     description: Adds or removes yourself from a specific queue.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     tags:
 *       - queue
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: The slug identifier of the queue.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The Steam ID of the user.
 *                 example: "steam_123456789"
 *               action:
 *                 type: string
 *                 description: Action to perform on the queue.
 *                 enum: [join, leave]
 *                 default: join
 *     responses:
 *       200:
 *         description: User successfully added or removed from the queue.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing user ID or invalid action.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User ID is required."
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.put('/:slug', Utils.ensureAuthenticated, async (req, res) => {
  const slug: string = req.params.slug;
  const action: string = req.body[0]?.action ? req.body[0].action : 'join';

  try {
    const maxQueueCount: number = await QueueService.getCurrentQueueMaxCount(slug);
    if (action === 'join') {
      await QueueService.addUserToQueue(slug, req.user?.steam_id!, req.user?.name!);
      const currentQueueCount = await QueueService.getCurrentQueuePlayerCount(slug);
      GlobalEmitter.emit("queueUpdate", {
        slug,
        action: "join",
        actorSteamId: req.user?.steam_id,
        currentQueueCount,
        maxQueueCount
      });
      if (currentQueueCount === maxQueueCount) {
        const acquired = await QueueService.tryAcquireQueueLock(slug);
        if (acquired) {
          try {
            const countAfterLock = await QueueService.getCurrentQueuePlayerCount(slug);
            if (countAfterLock === maxQueueCount) {
              const teamIds = await QueueService.createTeamsFromQueue(slug);
              console.log('Created teams from full queue:', teamIds);
              const matchId = await QueueService.createMatchFromQueue(slug, teamIds);
              if (matchId != null) {
                return res.status(200).json({ success: true, matchId, message: 'Match created successfully from full queue.' });
              }
              await QueueService.deleteTeams(teamIds);
              res.status(500).json({ error: 'Failed to create match from queue.' });
              return;
            }
          } catch (err) {
            console.error('Error creating teams or match from queue:', err);
            if (err instanceof QueueOwnerDatHostConfigMissingError) {
              res.status(412).json({
                error:
                  "Queue owner has not configured DatHost credentials. Ask the queue owner to configure DatHost in Settings."
              });
              return;
            }
            res.status(500).json({ error: 'Failed to create teams or match from queue.' });
            return;
          } finally {
            await QueueService.releaseQueueLock(slug);
          }
        }
      }
    } else if (action === 'leave') {
      await QueueService.removeUserFromQueue(slug, req.user?.steam_id!, req.user?.steam_id!);
      const newCount = await QueueService.getCurrentQueuePlayerCount(slug);
      if (newCount === 0) {
        const role: string = getRequesterRole(req);
        try {
          await QueueService.deleteQueue(slug, req.user?.steam_id!, role);
        } catch (_) {
          // Permission denied (e.g. not owner) or queue already gone; leave still succeeded
        }
      }
      GlobalEmitter.emit("queueUpdate", {
        slug,
        action: "leave",
        actorSteamId: req.user?.steam_id,
        currentQueueCount: newCount,
        maxQueueCount
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "join" or "leave".' });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Error processing ${action} action for queue:`, error);
    res.status(500).json({ error: `Failed to ${action} user in queue.` });
  }

  /**
   * @swagger
   *
   * /queue/:
   *   delete:
   *     description: Delete a specific queue. Only the owner or admin/super_admin can delete their queue.
   *     produces:
   *       - application/json
   *     tags:
   *       - queue
   *     parameters:
   *       - name: slug
   *         in: path
   *         required: true
   *         description: The slug identifier of the queue.
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Queue deleted successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *       403:
   *         description: Permission denied.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "You do not have permission to delete this queue."
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/Error'
   */
  router.delete('/', Utils.ensureAuthenticated, async (req, res) => {
    const slug: string = req.body[0].slug;

    try {
      const role: string = getRequesterRole(req);
      await QueueService.deleteQueue(slug, req.user?.steam_id!, role);
      res.status(200).json({ message: "The queue has successfully been deleted!", success: true });
    } catch (error: Error | any) {
      console.error('Error deleting queue:', error);
      if (error.message.includes('permission')) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Queue not found.' });
      }
      res.status(500).json({ error: 'Failed to delete queue.' });
    }
  });

});



export default router;
