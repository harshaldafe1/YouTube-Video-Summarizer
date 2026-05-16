/**
 * Routes for the summarization API.
 *
 * POST /summarize   — submit a YouTube URL
 * GET  /result/:jobId — poll for results
 */

import {
    Router
} from 'express';
import {
    body
} from 'express-validator';
import {
    submitSummarize,
    getResult
} from '../controllers/summarize.controller.js';

const router = Router();

/* ── Validation middleware ──────────────────────────────────────────────── */
const validateSubmit = [
    body('youtube_url')
    .trim()
    .notEmpty()
    .withMessage('youtube_url is required.')
    .isURL({
        protocols: ['http', 'https'],
        require_protocol: true
    })
    .withMessage('youtube_url must be a valid URL.')
    .isLength({
        max: 500
    })
    .withMessage('youtube_url is too long.'),
];

/* ── Route definitions ──────────────────────────────────────────────────── */
router.post('/summarize', validateSubmit, submitSummarize);
router.get('/result/:jobId', getResult);

export default router;