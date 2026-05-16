/**
 * summarization.service.js
 *
 * Two-phase Map-Reduce summarization with multiple backend support:
 * - Ollama (FREE, unlimited, local) - REQUIRED
 *
 * MAP    — Summarize each transcript chunk independently into bullet points.
 * REDUCE — Combine all bullet-point summaries into a structured final summary.
 */

import { Ollama } from 'ollama';
import logger from '../utils/logger.js';

// Lazy-initialised client
let _ollama = null;

// Model configurations
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/* ── Client initialization ──────────────────────────────────────────────── */

function getOllama() {
    if (!_ollama) {
        const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
        _ollama = new Ollama({
            host
        });
        logger.info(`[summarization.service] Ollama client initialized (${host})`);
    }
    return _ollama;
}

/* ── Backend-specific summarization ─────────────────────────────────────── */

async function summarizeWithOllama(prompt) {
    const ollama = getOllama();

    try {
        const response = await ollama.generate({
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
        });

        return response.response.trim();
    } catch (err) {
        logger.error(`[summarization.service] Ollama error: ${err.message}`);
        throw new Error(`Ollama summarization failed: ${err.message}`);
    }
}

/* ── MAP step ───────────────────────────────────────────────────────────── */

/**
 * Summarizes a single transcript chunk into concise bullet points.
 *
 * @param {string} chunk   A transcript chunk (~1500 tokens)
 * @param {number} index   Chunk index (for logging)
 * @returns {Promise<string>} Bullet-point summary
 */
export async function summarizeChunk(chunk, index) {
    logger.info(`[summarization.service] MAP: summarizing chunk ${index + 1} using ollama`);

    const prompt = `You are an expert content analyst. Extract the key points from the provided transcript chunk. Return ONLY concise bullet points (•). No intro, no outro.

Transcript chunk:

${chunk}`;

    const summary = await summarizeWithOllama(prompt);

    logger.info(`[summarization.service] MAP chunk ${index + 1} done.`);
    return summary;
}

/**
 * Runs the MAP step over all chunks in parallel (with concurrency cap).
 *
 * @param {string[]} chunks
 * @returns {Promise<string[]>} Array of per-chunk bullet summaries
 */
export async function mapSummarize(chunks) {
    const CONCURRENCY = 2;
    const results = new Array(chunks.length);

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map((chunk, batchIdx) => summarizeChunk(chunk, i + batchIdx))
        );
        batchResults.forEach((r, batchIdx) => {
            results[i + batchIdx] = r;
        });
    }

    return results;
}

/* ── REDUCE step ────────────────────────────────────────────────────────── */

/**
 * Combines all chunk summaries into a structured final summary.
 *
 * @param {string[]} chunkSummaries  Array of bullet-point summaries from MAP
 * @param {string}   videoTitle      Video title (for context)
 * @returns {Promise<{title:string, overview:string, keyPoints:string[], takeaways:string[]}>}
 */
export async function reduceSummarize(chunkSummaries, videoTitle = '') {
    logger.info(
        `[summarization.service] REDUCE: combining ${chunkSummaries.length} chunk summaries using ollama`
    );

    const combinedBullets = chunkSummaries.join('\n\n');

    const prompt = `You are an expert content summarizer.
You will receive bullet-point summaries from different sections of a YouTube video transcript.
Combine them into a single, well-structured summary.

${videoTitle ? `Video title: "${videoTitle}"\n\n` : ''}Chunk summaries:

${combinedBullets}

Respond ONLY with valid JSON matching this exact schema (no markdown, no code fences):
{
  "title": "string — concise video title",
  "overview": "string — 3 to 5 sentence overview of the entire video",
  "keyPoints": ["string", "..."],
  "takeaways": ["string", "..."]
}

Rules:
- keyPoints: 8 to 12 items, each a single clear sentence
- takeaways: 3 to 6 actionable or memorable conclusions
- Do NOT include any text outside the JSON object`;

    let raw;

    try {
        const ollama = getOllama();
        const ollamaResponse = await ollama.generate({
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            format: 'json', // Request JSON format
        });
        raw = ollamaResponse.response.trim();

        // Remove markdown code fences if present
        raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            logger.error(`[summarization.service] Failed to parse REDUCE JSON: ${raw}`);
            throw new Error(`LLM returned invalid JSON in REDUCE step: ${err.message}`);
        }

        // Validate and normalise the shape
        const summary = {
            title: typeof parsed.title === 'string' ? parsed.title : videoTitle,
            overview: typeof parsed.overview === 'string' ? parsed.overview : '',
            keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
            takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
        };

        logger.info('[summarization.service] REDUCE complete.');
        return summary;

    } catch (err) {
        logger.error(`[summarization.service] REDUCE failed: ${err.message}`);
        throw new Error(`Ollama REDUCE failed: ${err.message}`);
    }
}