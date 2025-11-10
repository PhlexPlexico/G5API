export interface QueueDescriptor {
  name: string;           // Human-readable name
  createdAt: number;      // Timestamp (ms) when queue was created
  expiresAt: number;      // Timestamp (ms) when queue will expire
  ownerId?: string;       // Optional user ID of the queue creator
  maxSize: number;        // Max number of players allowed in the queue
  isPrivate?: boolean;    // Optional flag for visibility
  currentPlayers: number; // Current number of players in the queue
}