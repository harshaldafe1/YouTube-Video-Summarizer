/**
 * MongoDB Atlas connection via Mongoose.
 * Exports a connect() function called once at server startup.
 *
 * All connection options (ssl, authSource, replicaSet) are already
 * embedded in the MONGODB_URI query string — no need to repeat them here.
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export async function connectDB() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    mongoose.connection.on('connected', () =>
        logger.info('MongoDB Atlas connected.')
    );
    mongoose.connection.on('error', (err) =>
        logger.error(`MongoDB connection error: ${err.message}`)
    );
    mongoose.connection.on('disconnected', () =>
        logger.warn('MongoDB disconnected.')
    );

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000, // 30s to find a replica set member
        socketTimeoutMS: 60000, // 60s socket idle timeout
        connectTimeoutMS: 30000, // 30s initial TCP connect timeout
    });
}