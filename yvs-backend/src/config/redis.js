/**
 * Shared Redis connection options for BullMQ.
 *
 * Supports two modes:
 *   1. REDIS_URL  — a full redis:// URL (Redis Cloud, Upstash, Railway, etc.)
 *   2. REDIS_HOST + REDIS_PORT + REDIS_PASSWORD — individual fields (local Redis)
 *
 * BullMQ requires maxRetriesPerRequest: null and enableReadyCheck: false.
 */

export function getRedisOptions() {
    // Mode 1: full URL (Redis Cloud provides this)
    if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
        const url = new URL(process.env.REDIS_URL.trim());

        const opts = {
            host: url.hostname,
            port: parseInt(url.port, 10),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            // Add connection timeout and retry settings
            connectTimeout: 10000, // 10 seconds
            retryStrategy: (times) => {
                const delay = Math.min(times * 1000, 10000); // Max 10 seconds
                console.log(`[redis] Retrying connection in ${delay}ms (attempt ${times})`);
                return delay;
            },
        };

        // Password is in the URL as :password@host
        if (url.password) {
            opts.password = decodeURIComponent(url.password);
        }

        // Only use TLS if explicitly specified with rediss:// protocol
        if (url.protocol === 'rediss:') {
            opts.tls = {
                rejectUnauthorized: false
            };
        }

        console.log(`[redis] Connecting to Redis Cloud: ${url.hostname}:${url.port}`);
        return opts;
    }

    // Mode 2: individual host/port fields (local Redis)
    const opts = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        connectTimeout: 5000,
    };

    if (process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== '') {
        opts.password = process.env.REDIS_PASSWORD.trim();
    }

    console.log(`[redis] Connecting to local Redis: ${opts.host}:${opts.port}`);
    return opts;
}