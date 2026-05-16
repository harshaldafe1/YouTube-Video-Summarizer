/**
 * Express application factory.
 * Separated from server.js so it can be imported in tests without
 * starting the HTTP server.
 */

import express from 'express';
import cors from 'cors';
import summarizeRoutes from './routes/summarize.routes.js';
import healthRoutes from './routes/health.routes.js';
import logger from './utils/logger.js';

export function createApp() {
    const app = express();

    /* ── CORS ─────────────────────────────────────────────────────────────── */
    const allowedOrigins = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (curl, Postman, server-to-server)
                if (!origin) return callback(null, true);
                if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                callback(new Error(`CORS: origin "${origin}" not allowed.`));
            },
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        })
    );

    /* ── Body parsing ─────────────────────────────────────────────────────── */
    app.use(express.json({
        limit: '1mb'
    }));
    app.use(express.urlencoded({
        extended: false
    }));

    /* ── Request logging (dev only) ───────────────────────────────────────── */
    if (process.env.NODE_ENV !== 'production') {
        app.use((req, _res, next) => {
            logger.info(`→ ${req.method} ${req.path}`);
            next();
        });
    }

    /* ── Routes ───────────────────────────────────────────────────────────── */
    app.use('/api', summarizeRoutes);
    app.use('/api', healthRoutes);

    /* ── 404 handler ──────────────────────────────────────────────────────── */
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            errors: [`Route ${req.method} ${req.path} not found.`]
        });
    });

    /* ── Global error handler ─────────────────────────────────────────────── */
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        logger.error(`Unhandled error: ${err.message}`, {
            stack: err.stack
        });
        res.status(500).json({
            success: false,
            errors: ['Internal server error.']
        });
    });

    return app;
}