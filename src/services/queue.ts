import config from "config";
import Utils from "../utility/utils.js";
import { QueueDescriptor } from "../types/queues/QueueDescriptor.js"
import { QueueItem } from "../types/queues/QueueItem.js";
import { createClient } from "redis";

const redis = createClient({ url: config.get("server.redisUrl"), });
const DEFAULT_TTL_SECONDS: number = config.get("server.queueTTL") == 0 ? 3600 : config.get("server.queueTTL");

export class QueueService {
  
  static async createQueue(ownerId?: string, maxPlayers: number = 10, isPrivate: boolean = false, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<QueueDescriptor> {
    let slug: string;
    let key: string;
    let attempts: number = 0;
    if (redis.isOpen === false) {
      await redis.connect();
    }
    do {
      slug = Utils.generateSlug();
      key = `queue:${slug}`;
      const exists = await redis.exists(key);
      if (!exists) break;
      attempts++;
    } while (attempts < 5);

    if (attempts === 5) {
      throw new Error('Failed to generate a unique queue slug after 5 attempts.');
    }

    const createdAt = Date.now();
    const expiresAt = createdAt + ttlSeconds * 1000;

    const descriptor: QueueDescriptor = {
      name: slug,
      createdAt,
      expiresAt,
      ownerId,
      maxSize: maxPlayers,
      isPrivate: isPrivate
    };

    await redis.sAdd('queues', slug);
    await redis.expire(key, ttlSeconds);
    await redis.set(`queue-meta:${slug}`, JSON.stringify(descriptor), { EX: ttlSeconds });

    return descriptor;
  }

  static async deleteQueue(
    slug: string,
    requestorSteamId: string,
    role: string = "user"
  ): Promise<void> {
    const key = `queue:${slug}`;
    const metaKey = `queue-meta:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);

    // Permission check
    const isOwner = meta.ownerId === requestorSteamId;
    const isAdmin = role === 'admin' || role === 'super_admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to delete this queue.');
    }

    // Delete queue data
    await redis.del(key);        // Remove queue list
    await redis.del(metaKey);    // Remove metadata
    await redis.sRem('queues', slug); // Remove from global queue list
  }

  static async addUserToQueue(
    slug: string,
    steamId: string,
  ): Promise<void> {
    const key = `queue:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);


    const currentUsers = await redis.lRange(key, 0, -1);
    const alreadyInQueue = currentUsers.some((item: string) => {
      const parsed = JSON.parse(item);
      return parsed.steamId === steamId;
    });
    if (alreadyInQueue) {
      throw new Error(`Steam ID ${steamId} is already in the queue.`);
    }

    if (meta.maxSize && currentUsers.length >= meta.maxSize) {
      throw new Error(`Queue ${slug} is full.`);
    }

    const hltvRating = await Utils.getRatingFromSteamId(steamId);

    const item: QueueItem = {
      steamId,
      timestamp: Date.now(),
      hltvRating: hltvRating ?? undefined
    };

    await redis.rPush(key, JSON.stringify(item));
  }

  static async removeUserFromQueue(
    slug: string,
    steamId: string,
    requestorSteamId: string,
    role: string = "user"
  ): Promise<boolean> {
    const key = `queue:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);

    // Permission check
    if (
      role === 'user' &&
      steamId !== requestorSteamId &&
      meta.ownerId !== requestorSteamId
    ) {
      throw new Error('You do not have permission to remove other users from this queue.');
    }

    const currentUsers = await redis.lRange(key, 0, -1);
    for (const item of currentUsers) {
      const parsed = JSON.parse(item);
      if (parsed.steamId === steamId) {
        await redis.lRem(key, 1, item);
        return true;
      }
    }

    return false;
  }

  static async listUsersInQueue(slug: string, role: string = "user", requestorSteamId: string): Promise<QueueItem[]> {
    const key = `queue:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);

    const rawItems = await redis.lRange(key, 0, -1);
    return rawItems.map((item: string) => JSON.parse(item));
  }

  static async listQueues(requestorSteamId: string, role: string = "user"): Promise<QueueDescriptor[]> {
    if (redis.isOpen === false) {
      await redis.connect();
    }
    const slugs = await redis.sMembers('queues');
    const descriptors: QueueDescriptor[] = [];

    for (const slug of slugs) {
      const metaRaw = await redis.get(`queue-meta:${slug}`);
      if (!metaRaw) continue;

      const meta: QueueDescriptor = JSON.parse(metaRaw);

      if (role === 'admin' || role === 'super_admin' || meta.ownerId === requestorSteamId || meta.isPrivate === false) {
        descriptors.push(meta);
      }
    }

    return descriptors;
  }

  static async getQueue(slug: string, role: string, requestorSteamId: string): Promise<QueueDescriptor> {
    const meta = await getQueueMetaOrThrow(slug);
    if (role === 'admin' || role === 'super_admin' || meta.ownerId === requestorSteamId || meta.isPrivate === false) {
      return meta;
    }
    throw new Error('You do not have permission to remove other users from this queue.');
  }

}

async function getQueueMetaOrThrow(slug: string): Promise<QueueDescriptor> {
  if (redis.isOpen === false) {
    await redis.connect();
  }
  const metaKey = `queue-meta:${slug}`;
  const members = await redis.sMembers('queues');
  if (!members.includes(slug)) {
    throw new Error(`Queue ${slug} does not exist or has expired.`);
  }

  const metaRaw = await redis.get(metaKey);
  if (!metaRaw) {
    throw new Error(`Queue metadata missing for ${slug}.`);
  }

  return JSON.parse(metaRaw);
}

export default QueueService;