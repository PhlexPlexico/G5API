export interface QueueDescriptor {
  name: string;           // Human-readable name
  slug: string;           // Unique identifier
  createdAt: number;      // Timestamp (ms) when queue was created
  expiresAt: number;      // Timestamp (ms) when queue will expire
  ownerId?: string;       // Optional user ID of the queue creator
  maxSize?: number;       // Optional max number of users allowed
  isPrivate?: boolean;    // Optional flag for visibility
}