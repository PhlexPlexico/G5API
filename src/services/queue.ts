import config from "config";
import Utils from "../utility/utils.js";
import { QueueDescriptor } from "../types/queues/QueueDescriptor.js"
import { QueueItem } from "../types/queues/QueueItem.js";
import { createClient } from "redis";

const redis = createClient({ url: config.get("server.redisUrl"), });
const DEFAULT_TTL_SECONDS: number = config.get("server.queueTTL") == 0 ? 3600 : config.get("server.queueTTL");

export class QueueService {
  async createQueue(ttlSeconds = DEFAULT_TTL_SECONDS, ownerId?: string, maxPlayers: number = 10): Promise<QueueDescriptor> {
    let slug: string;
    let key: string;
    let attempts: number = 0;

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
      slug,
      createdAt,
      expiresAt,
      ownerId,
      maxSize: maxPlayers,
      isPrivate: false
    };

    await redis.sAdd('queues', slug);
    await redis.expire(key, ttlSeconds);
    await redis.set(`queue-meta:${slug}`, JSON.stringify(descriptor), { EX: ttlSeconds });

    return descriptor;
  }

  async deleteQueue(
    slug: string,
    requesterSteamId: string,
    role: 'user' | 'admin' | 'super_admin'
  ): Promise<void> {
    const key = `queue:${slug}`;
    const metaKey = `queue-meta:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);

    // Permission check
    const isOwner = meta.ownerId === requesterSteamId;
    const isAdmin = role === 'admin' || role === 'super_admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to delete this queue.');
    }

    // Delete queue data
    await redis.del(key);        // Remove queue list
    await redis.del(metaKey);    // Remove metadata
    await redis.sRem('queues', slug); // Remove from global queue list
  }

  async addUserToQueue(
    slug: string,
    steamId: string,
    requesterSteamId: string,
    role: 'user' | 'admin' | 'super_admin'
  ): Promise<void> {
    const key = `queue:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);

    // Permission check
    if (
      role === 'user' &&
      steamId !== requesterSteamId &&
      meta.ownerId !== requesterSteamId
    ) {
      throw new Error('You do not have permission to add other users to this queue.');
    }

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

  async removeUserFromQueue(
    slug: string,
    steamId: string,
    requesterSteamId: string,
    role: 'user' | 'admin' | 'super_admin'
  ): Promise<boolean> {
    const key = `queue:${slug}`;
    const meta = await getQueueMetaOrThrow(slug);

    // Permission check
    if (
      role === 'user' &&
      steamId !== requesterSteamId &&
      meta.ownerId !== requesterSteamId
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

  async listUsersInQueue(slug: string): Promise<QueueItem[]> {
    const key = `queue:${slug}`;
    const exists = await redis.exists(key);
    if (!exists) throw new Error(`Queue ${slug} does not exist or has expired.`);

    const rawItems = await redis.lRange(key, 0, -1);
    return rawItems.map((item: string) => JSON.parse(item));
  }

  async listQueues(requesterSteamId: string, role: 'user' | 'admin' | 'super_admin'): Promise<QueueDescriptor[]> {
    const slugs = await redis.sMembers('queues');
    const descriptors: QueueDescriptor[] = [];

    for (const slug of slugs) {
      const metaRaw = await redis.get(`queue-meta:${slug}`);
      if (!metaRaw) continue;

      const meta: QueueDescriptor = JSON.parse(metaRaw);

      if (role === 'admin' || role === 'super_admin' || meta.ownerId === requesterSteamId) {
        descriptors.push(meta);
      }
    }

    return descriptors;
  }

}

async function getQueueMetaOrThrow(slug: string): Promise<QueueDescriptor> {
  const key = `queue:${slug}`;
  const metaKey = `queue-meta:${slug}`;

  const exists = await redis.exists(key);
  if (!exists) {
    throw new Error(`Queue ${slug} does not exist or has expired.`);
  }

  const metaRaw = await redis.get(metaKey);
  if (!metaRaw) {
    throw new Error(`Queue metadata missing for ${slug}.`);
  }

  return JSON.parse(metaRaw);
}

export default QueueService;