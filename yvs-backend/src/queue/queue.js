/**
 * BullMQ Queue definition.
 * Import this wherever you need to add jobs (e.g. the controller).
 */

import {
    Queue
} from 'bullmq';
import {
    getRedisOptions
} from '../config/redis.js';

export const QUEUE_NAME = 'video-summarization';

// Singleton queue instance
let _queue = null;

export function getSummarizationQueue() {
    if (!_queue) {
        _queue = new Queue(QUEUE_NAME, {
            connection: getRedisOptions(),
            defaultJobOptions: {
                attempts: parseInt(process.env.JOB_ATTEMPTS || '3', 10),
                backoff: {
                    type: 'exponential',
                    delay: parseInt(process.env.JOB_BACKOFF_DELAY || '5000', 10),
                },
                removeOnComplete: {
                    count: 100
                }, // keep last 100 completed jobs
                removeOnFail: {
                    count: 200
                }, // keep last 200 failed jobs
                // Increase lock duration for long-running transcription jobs
                lockDuration: 600000, // 10 minutes (600,000 ms)
            },
        });
    }
    return _queue;
}