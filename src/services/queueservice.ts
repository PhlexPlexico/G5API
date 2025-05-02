import config from "config";
import { createClient } from "redis";

type QueueProcessor<T> = (items: T[]) => Promise<void>;

class QueueService<T> {
  private redisClient;
  private queueLimit: number;
  private processors: Map<string, QueueProcessor<T>>;

  constructor(redisUrl: string, queueLimit: number = 10) {
    this.redisClient = createClient({ url: config.get("server.redisUrl"), });
    this.queueLimit = queueLimit;
    this.processors = new Map();

    this.redisClient.on("error", (err) => {
      console.log("Redis error: ", err);
    });

    this.redisClient.connect();
  }

  // Register a queue with a processor
  async registerQueue(queueName: string, processor: QueueProcessor<T>): Promise<void> {
    if (this.processors.has(queueName)) {
      throw new Error(`Queue "${queueName}" is already registered.`);
    }
    this.processors.set(queueName, processor);
  }

  // Add an object to a specific queue
  async addToQueue(queueName: string, item: T): Promise<void> {
    const serializedItem = JSON.stringify(item);
    await this.redisClient.rPush(queueName, serializedItem);

    const queueLength = await this.redisClient.lLen(queueName);
    if (queueLength >= this.queueLimit) {
      await this.processQueue(queueName);
    }
  }

  // Check if a queue already exists in Redis
  async isQueueCreated(queueName: string): Promise<boolean> {
    const exists = await this.redisClient.exists(queueName);
    return exists === 1; // Returns true if the queue exists, false otherwise
  }


  // Process a specific queue
  private async processQueue(queueName: string): Promise<void> {
    const processor = this.processors.get(queueName);
    if (!processor) {
      throw new Error(`No processor registered for queue "${queueName}".`);
    }

    const items = await this.redisClient.lRange(queueName, 0, this.queueLimit - 1);
    if (items.length === 0) return;

    const deserializedItems = items.map((item) => JSON.parse(item) as T);

    // Process the items
    await processor(deserializedItems);

    // Remove processed items from the queue
    await this.redisClient.lTrim(queueName, items.length, -1);
  }

  // Disconnect the Redis client
  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }
}

export default QueueService;