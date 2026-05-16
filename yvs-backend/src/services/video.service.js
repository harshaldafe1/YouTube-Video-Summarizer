/**
 * video.service.js
 *
 * Handles audio extraction from YouTube using yt-dlp,
 * then normalises the audio to 16 kHz mono WAV using FFmpeg.
 *
 * NOTE: env vars are read inside functions (not at module load time)
 * so dotenv has always finished loading before they are accessed.
 */

import {
    execFile
} from 'child_process';
import {
    promisify
} from 'util';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

/* ── Helpers ────────────────────────────────────────────────────────────── */

function getYtdlpPath() {
    return process.env.YTDLP_PATH || 'yt-dlp';
}

function getFfmpegPath() {
    return process.env.FFMPEG_PATH || 'ffmpeg';
}

function getTempDir() {
    return process.env.TEMP_DIR || './tmp';
}

function ensureTempDir() {
    const dir = getTempDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
            recursive: true
        });
    }
}

/**
 * Returns the DIRECTORY containing ffmpeg.exe.
 * yt-dlp --ffmpeg-location expects a folder, not the full exe path.
 * Always returns a value so --ffmpeg-location is always passed.
 */
function getFfmpegDir() {
    const ffmpegPath = getFfmpegPath();
    // If it's a full path (contains a separator), return its directory
    if (ffmpegPath.includes(path.sep) || ffmpegPath.includes('/')) {
        return path.dirname(ffmpegPath);
    }
    // It's just "ffmpeg" — resolve it from PATH using 'where' on Windows
    // Return '.' as fallback so yt-dlp still searches PATH
    return null;
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Downloads the best audio stream from a YouTube URL using yt-dlp.
 *
 * @param {string} videoId
 * @param {string} url
 * @returns {Promise<string>} Path to the downloaded audio file
 */
export async function downloadAudio(videoId, url) {
    ensureTempDir();

    const YTDLP_PATH = getYtdlpPath();
    const TEMP_DIR = getTempDir();
    const outputTemplate = path.join(TEMP_DIR, `${videoId}.%(ext)s`);

    logger.info(`[video.service] yt-dlp path: ${YTDLP_PATH}`);
    logger.info(`[video.service] ffmpeg path: ${getFfmpegPath()}`);
    logger.info(`[video.service] Downloading audio for ${videoId}`);

    const args = [
        url,
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--output', outputTemplate,
        '--no-playlist',
        '--no-warnings',
        '--quiet',
    ];

    // Always pass --ffmpeg-location so yt-dlp can post-process the audio
    const ffmpegDir = getFfmpegDir();
    if (ffmpegDir) {
        args.push('--ffmpeg-location', ffmpegDir);
        logger.info(`[video.service] Using --ffmpeg-location: ${ffmpegDir}`);
    } else {
        // ffmpeg is just "ffmpeg" in PATH — pass the exe name directly
        args.push('--ffmpeg-location', getFfmpegPath());
        logger.info(`[video.service] Using --ffmpeg-location: ${getFfmpegPath()}`);
    }

    try {
        await execFileAsync(YTDLP_PATH, args, {
            timeout: 300000
        });
    } catch (err) {
        throw new Error(`yt-dlp failed: ${err.message}`);
    }

    const files = fs.readdirSync(TEMP_DIR).filter((f) => f.startsWith(videoId));
    if (files.length === 0) {
        throw new Error(`yt-dlp produced no output file for videoId ${videoId}`);
    }

    const rawPath = path.join(TEMP_DIR, files[0]);
    logger.info(`[video.service] Audio downloaded: ${rawPath}`);
    return rawPath;
}

/**
 * Normalises audio to 16 kHz mono WAV using FFmpeg.
 *
 * @param {string} inputPath
 * @param {string} videoId
 * @returns {Promise<string>} Path to the normalised WAV file
 */
export async function normaliseAudio(inputPath, videoId) {
    ensureTempDir();

    const FFMPEG_PATH = getFfmpegPath();
    const outputPath = path.join(getTempDir(), `${videoId}_norm.wav`);

    logger.info(`[video.service] Normalising audio → ${outputPath}`);

    const args = [
        '-y',
        '-i', inputPath,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        outputPath,
    ];

    try {
        await execFileAsync(FFMPEG_PATH, args, {
            timeout: 300000
        });
    } catch (err) {
        throw new Error(`FFmpeg normalisation failed: ${err.message}`);
    }

    logger.info(`[video.service] Audio normalised: ${outputPath}`);
    return outputPath;
}

/**
 * Deletes a file silently.
 * @param {string} filePath
 */
export function deleteFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`[video.service] Deleted temp file: ${filePath}`);
        }
    } catch (err) {
        logger.warn(`[video.service] Could not delete ${filePath}: ${err.message}`);
    }
}

/**
 * Fetches the video title using yt-dlp --get-title.
 * Returns empty string on failure (non-critical).
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchVideoTitle(url) {
    try {
        const {
            stdout
        } = await execFileAsync(
            getYtdlpPath(),
            ['--get-title', '--no-warnings', '--quiet', url], {
                timeout: 30000
            }
        );
        return stdout.trim();
    } catch {
        return '';
    }
}