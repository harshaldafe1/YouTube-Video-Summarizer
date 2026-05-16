/**
 * YouTube URL utilities.
 * Validates URLs and extracts the 11-character video ID.
 */

// Matches standard watch URLs, short youtu.be links, and embed URLs
const YT_REGEX =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

/**
 * Returns the video ID if the URL is a valid YouTube URL, otherwise null.
 * @param {string} url
 * @returns {string|null}
 */
export function extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(YT_REGEX);
    return match ? match[1] : null;
}

/**
 * Returns true if the URL is a valid YouTube URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidYouTubeUrl(url) {
    return extractVideoId(url) !== null;
}

/**
 * Normalises a YouTube URL to the canonical watch form.
 * @param {string} videoId
 * @returns {string}
 */
export function canonicalUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}