/**
 * Transcript chunker.
 *
 * Splits a long transcript into chunks of approximately `maxTokens` tokens
 * while respecting sentence boundaries (splits on ". ", "! ", "? ").
 *
 * Token estimation: 1 token ≈ 4 characters (conservative GPT approximation).
 */

const CHARS_PER_TOKEN = 4;

/**
 * @param {string} transcript  Full transcript text
 * @param {number} maxTokens   Target max tokens per chunk (default 1500)
 * @returns {string[]}         Array of text chunks
 */
export function chunkTranscript(transcript, maxTokens = 1500) {
    if (!transcript || transcript.trim().length === 0) return [];

    const maxChars = maxTokens * CHARS_PER_TOKEN;

    // Split into sentences on common sentence-ending punctuation
    const sentenceEnders = /(?<=[.!?])\s+/;
    const sentences = transcript.split(sentenceEnders).filter(Boolean);

    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
        // If a single sentence exceeds the limit, hard-split it
        if (sentence.length > maxChars) {
            if (current.trim()) {
                chunks.push(current.trim());
                current = '';
            }
            // Hard split the oversized sentence
            for (let i = 0; i < sentence.length; i += maxChars) {
                chunks.push(sentence.slice(i, i + maxChars).trim());
            }
            continue;
        }

        if ((current + ' ' + sentence).length > maxChars) {
            if (current.trim()) chunks.push(current.trim());
            current = sentence;
        } else {
            current = current ? current + ' ' + sentence : sentence;
        }
    }

    if (current.trim()) chunks.push(current.trim());

    return chunks;
}