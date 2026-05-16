/**
 * Health check endpoint.
 * GET /health — used by load balancers, Docker, and uptime monitors.
 */

import {
    Router
} from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const dbStatus = states[dbState] !== undefined ? states[dbState] : 'unknown';

    const healthy = dbState === 1;

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus,
        },
    });
});

export default router;