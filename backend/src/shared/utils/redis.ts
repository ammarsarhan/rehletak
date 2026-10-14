import "./env.js";
import { Redis, type RedisOptions } from "ioredis";

// Two separate Redis services: the cache may evict keys (allkeys-lru), the queue must never evict (noeviction).
const cacheUrl = process.env.CACHE_URL;
const queueUrl = process.env.QUEUE_URL;

if (!cacheUrl || !queueUrl) {
    throw new Error("CACHE_URL and QUEUE_URL must both be defined in the environment variables.");
}

// Railway's private network is IPv6-only, and ioredis defaults to IPv4. family: 0 lets it resolve either.
const baseOptions: RedisOptions = { family: 0 };

export const cache = new Redis(cacheUrl, baseOptions);

// BullMQ needs maxRetriesPerRequest: null so blocking commands wait for Redis instead of failing mid-job.
// Each Queue/Worker gets its own connection from here, since workers hold a blocking connection open.
export const createQueueConnection = () => new Redis(queueUrl, { ...baseOptions, maxRetriesPerRequest: null });
