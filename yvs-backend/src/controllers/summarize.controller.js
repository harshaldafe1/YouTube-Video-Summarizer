/**
 * summarize.controller.js
 *
 * POST /summarize
 *   - Validates the YouTube URL
 *   - Returns cached result if already processed
 *   - Otherwise creates a BullMQ job and returns jobId
 *
 * GET /result/:jobId
 *   - Returns current status + summary (if completed)
 */

import {
    validationResult
} from 'express-validator';
import {
    getSummarizationQueue
} from '../queue/queue.js';
import Video from '../models/Video.js';
import {
    extractVideoId,
    canonicalUrl
} from '../utils/youtube.js';
import logger from '../utils/logger.js';

/* ── POST /summarize ────────────────────────────────────────────────────── */

export async function submitSummarize(req, res) {
    // 1. Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map((e) => e.msg),
        });
    }

    const {
        youtube_url
    } = req.body;

    // 2. Extract and validate video ID
    const videoId = extractVideoId(youtube_url);
    if (!videoId) {
        return res.status(400).json({
            success: false,
            errors: ['Invalid YouTube URL. Could not extract video ID.'],
        });
    }

    const url = canonicalUrl(videoId); // normalise to canonical form

    try {
        // 3. Check if already in DB
        const existing = await Video.findOne({
            videoId
        });

        if (existing) {
            if (existing.status === 'completed') {
                logger.info(`[summarize.controller] Cache hit for videoId: ${videoId}`);
                return res.status(200).json({
                    success: true,
                    cached: true,
                    jobId: existing.jobId,
                    status: 'completed',
                    summary: existing.summary,
                    title: existing.title,
                });
            }

            if (existing.status === 'processing') {
                return res.status(202).json({
                    success: true,
                    cached: true,
                    jobId: existing.jobId,
                    status: 'processing',
                    message: 'This video is already being processed.',
                });
            }

            // status === 'failed' — allow re-processing
            logger.info(`[summarize.controller] Re-processing failed job for videoId: ${videoId}`);
            await Video.deleteOne({
                videoId
            });
        }

        // 4. Create DB record (status: processing)
        const videoDoc = await Video.create({
            url,
            videoId,
            status: 'processing'
        });

        // 5. Enqueue job
        const queue = getSummarizationQueue();
        const job = await queue.add(
            'summarize', {
                videoId,
                url
            }, {
                jobId: videoDoc._id.toString()
            } // use MongoDB _id as BullMQ jobId
        );

        // 6. Store jobId back on the document
        await Video.findByIdAndUpdate(videoDoc._id, {
            jobId: job.id
        });

        logger.info(`[summarize.controller] Job ${job.id} enqueued for videoId: ${videoId}`);

        return res.status(202).json({
            success: true,
            cached: false,
            jobId: job.id,
            status: 'processing',
            message: 'Video is being processed. Poll GET /result/:jobId for updates.',
        });

    } catch (err) {
        logger.error(`[summarize.controller] submitSummarize error: ${err.message}`);
        return res.status(500).json({
            success: false,
            errors: ['Internal server error. Please try again.'],
        });
    }
}

/* ── GET /result/:jobId ─────────────────────────────────────────────────── */

export async function getResult(req, res) {
    const {
        jobId
    } = req.params;

    if (!jobId || typeof jobId !== 'string') {
        return res.status(400).json({
            success: false,
            errors: ['Invalid jobId.']
        });
    }

    try {
        const video = await Video.findOne({
            jobId
        });

        if (!video) {
            return res.status(404).json({
                success: false,
                errors: [`No job found with id "${jobId}".`],
            });
        }

        const base = {
            success: true,
            jobId,
            status: video.status,
            videoId: video.videoId,
            title: video.title,
            url: video.url,
            createdAt: video.createdAt,
            updatedAt: video.updatedAt,
        };

        if (video.status === 'completed') {
            return res.status(200).json({
                ...base,
                summary: video.summary
            });
        }

        if (video.status === 'failed') {
            return res.status(200).json({
                ...base,
                errorMessage: video.errorMessage || 'Processing failed.',
            });
        }

        // Still processing — optionally include BullMQ progress
        const queue = getSummarizationQueue();
        const job = await queue.getJob(jobId);
        const progress = job ? await job.progress : null;

        return res.status(202).json({
            ...base,
            progress
        });

    } catch (err) {
        logger.error(`[summarize.controller] getResult error: ${err.message}`);
        return res.status(500).json({
            success: false,
            errors: ['Internal server error.'],
        });
    }
}