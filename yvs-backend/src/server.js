/**
 * Server entry point.
 * Loads env vars → connects DB → starts HTTP server.
 *
 * Run:  npm start   (production)
 *       npm run dev (development with nodemon)
 */

import 'dotenv/config';
import {
    fileURLToPath
} from 'url';
import {
    dirname,
    resolve
} from 'path';
import {
    config
} from 'dotenv';

// Explicitly load .env from the yvs-backend directory,
// so the server works no matter which folder you run it from.
const __dirname = dirname(fileURLToPath(
    import.meta.url));
config({
    path: resolve(__dirname, '../../.env')
});
import {
    createApp
} from './app.js';
import {
    connectDB
} from './config/db.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function bootstrap() {
    try {
        // 1. Connect to MongoDB Atlas
        await connectDB();

        // 2. Create Express app
        const app = createApp();

        // 3. Start HTTP server
        const server = app.listen(PORT, () => {
            logger.info(`YVS Backend running on http://localhost:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // 4. Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}. Shutting down...`);
            server.close(async () => {
                const mongoose = (await import('mongoose')).default;
                await mongoose.disconnect();
                logger.info('Server and DB connections closed.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // 5. Catch unhandled rejections (don't crash silently)
        process.on('unhandledRejection', (reason) => {
            logger.error(`Unhandled rejection: ${reason}`);
        });

    } catch (err) {
        logger.error(`Failed to start server: ${err.message}`);
        process.exit(1);
    }
}

bootstrap();