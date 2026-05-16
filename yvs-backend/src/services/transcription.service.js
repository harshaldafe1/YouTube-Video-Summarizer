/**
 * transcription.service.js
 *
 * Converts audio to text using either:
 *   - OpenAI Whisper API  (WHISPER_MODE=openai)  — easiest, no local install
 *   - Local Whisper CLI   (WHISPER_MODE=local)   — free, runs on your machine
 *
 * Set WHISPER_MODE in .env to choose.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import {
    execFile
} from 'child_process';
import {
    promisify
} from 'util';
import OpenAI from 'openai';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

// OpenAI client (lazy-initialised so the module loads even without a key)
let _openai = null;

// Custom HTTPS agent for better connection handling
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 300000, // 5 minutes
    scheduling: 'fifo',
});

function getOpenAI() {
    if (!_openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set in environment variables.');
        }
        _openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 300000, // 5 minutes timeout
            maxRetries: 3, // Increase retries for connection issues
            httpAgent: httpsAgent,
        });
        logger.info('[transcription.service] OpenAI client initialized with custom HTTPS agent');
    }
    return _openai;
}

/**
 * Transcribes an audio file to text.
 *
 * @param {string} audioPath  Path to the normalised WAV/MP3 file
 * @returns {Promise<string>} Full transcript text
 */
export async function transcribeAudio(audioPath) {
    const mode = (process.env.WHISPER_MODE || 'openai').toLowerCase();

    logger.info(`[transcription.service] Transcribing via mode="${mode}": ${audioPath}`);

    if (mode === 'openai') {
        return transcribeWithOpenAI(audioPath);
    } else if (mode === 'local') {
        return transcribeWithLocalWhisper(audioPath);
    } else {
        throw new Error(`Unknown WHISPER_MODE "${mode}". Use "openai" or "local".`);
    }
}

/* ── OpenAI Whisper API ─────────────────────────────────────────────────── */

/**
 * Uses the OpenAI Whisper API (whisper-1 model).
 * Max file size: 25 MB. For larger files use local Whisper.
 *
 * @param {string} audioPath
 * @returns {Promise<string>}
 */
async function transcribeWithOpenAI(audioPath) {
    const openai = getOpenAI();

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
    }

    const stats = fs.statSync(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    logger.info(`[transcription.service] File size: ${fileSizeMB.toFixed(2)} MB`);

    if (fileSizeMB > 24) {
        logger.warn(
            `[transcription.service] File is ${fileSizeMB.toFixed(1)} MB — ` +
            `approaching OpenAI 25 MB limit. Consider switching to WHISPER_MODE=local.`
        );
    }

    if (fileSizeMB === 0) {
        throw new Error(`Audio file is empty: ${audioPath}`);
    }

    logger.info(`[transcription.service] Creating file stream for: ${audioPath}`);
    const fileStream = fs.createReadStream(audioPath);

    // Add error handler for the stream
    fileStream.on('error', (err) => {
        logger.error(`[transcription.service] File stream error: ${err.message}`);
        throw err;
    });

    logger.info(`[transcription.service] Sending transcription request to OpenAI...`);

    let response;
    try {
        response = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: fileStream,
            response_format: 'text',
            language: 'en', // remove this line to auto-detect language
        });
    } catch (err) {
        logger.error(`[transcription.service] OpenAI API error: ${err.message}`);
        logger.error(`[transcription.service] Error type: ${err.constructor.name}`);
        logger.error(`[transcription.service] Error code: ${err.code}`);
        logger.error(`[transcription.service] Error status: ${err.status}`);

        // Check for specific error types
        if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
            throw new Error(`Network timeout while uploading audio file (${fileSizeMB.toFixed(1)} MB). Try a shorter video or use WHISPER_MODE=local.`);
        }

        if (err.message && err.message.includes('Connection error')) {
            throw new Error(`Failed to connect to OpenAI API. Check your internet connection, firewall settings, or try using WHISPER_MODE=local.`);
        }

        throw err;
    }

    // When response_format is "text", the SDK returns the string directly
    const transcript = typeof response === 'string' ? response : response.text;

    logger.info(
        `[transcription.service] OpenAI transcription complete. ` +
        `Length: ${transcript.length} chars`
    );

    return transcript;
}

/* ── Local Whisper CLI ──────────────────────────────────────────────────── */

/**
 * Runs the local `whisper` CLI binary.
 * Install: pip install openai-whisper
 *
 * @param {string} audioPath
 * @returns {Promise<string>}
 */
async function transcribeWithLocalWhisper(audioPath) {
    const whisperBin = process.env.WHISPER_LOCAL_PATH || 'whisper';
    const outputDir = path.dirname(audioPath);
    const baseName = path.basename(audioPath, path.extname(audioPath));

    const args = [
        audioPath,
        '--model', 'base',
        '--output_dir', outputDir,
        '--output_format', 'txt',
        '--language', 'en',
        '--fp16', 'False',
    ];

    logger.info(`[transcription.service] Running local Whisper on ${audioPath}`);

    try {
        await execFileAsync(whisperBin, args, {
            timeout: 1800000
        }); // 30 min
    } catch (err) {
        throw new Error(`Local Whisper failed: ${err.message}`);
    }

    // Whisper writes <basename>.txt in the output directory
    const txtPath = path.join(outputDir, `${baseName}.txt`);

    if (!fs.existsSync(txtPath)) {
        throw new Error(`Whisper output file not found: ${txtPath}`);
    }

    const transcript = fs.readFileSync(txtPath, 'utf-8');

    // Clean up the Whisper output file (we store transcript in DB)
    try {
        fs.unlinkSync(txtPath);
    } catch {
        /* ignore */
    }

    logger.info(
        `[transcription.service] Local Whisper complete. ` +
        `Length: ${transcript.length} chars`
    );

    return transcript;
}