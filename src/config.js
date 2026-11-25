/**
 * Central configuration. Every tunable number lives here.
 * @module config
 */

/** Gemini Live model: GA, low-latency native audio with background tool calls. */
export const LIVE_MODEL = 'gemini-3.8-live';
export const LIVE_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
/** Prebuilt voice for replies. */
export const VOICE_NAME = 'Kore';

/** Microphone audio sent to Gemini: 16-bit PCM, mono, 16 kHz. */
export const INPUT_SAMPLE_RATE = 16_000;
/** Default rate of Gemini's audio replies when the server does not state one. */
export const OUTPUT_SAMPLE_RATE = 24_000;
/** Send microphone audio in chunks of this length. */
export const CHUNK_MS = 100;
/** RMS level above which the technician is considered to be speaking. */
export const SPEECH_RMS = 0.02;
/** Silence after speech that marks the end of a spoken turn (for latency). */
export const END_OF_SPEECH_MS = 600;

/** How many passages a knowledge search returns. */
export const SEARCH_TOP_K = 4;
/** Longest text accepted from the model or the user in one field. */
export const MAX_FIELD_CHARS = 600;
/** First work-order number issued by the mock CMMS. */
export const FIRST_WORK_ORDER = 2533;
/** Give up connecting to Gemini after this long. */
export const CONNECT_TIMEOUT_MS = 15_000;

/** One hour in milliseconds. */
export const MS_PER_HOUR = 3_600_000;
/** Assumed line-stoppage cost used for the savings estimate (₹ per hour). */
export const DOWNTIME_COST_PER_HOUR = 20_000;

/** Model IDs accepted in settings. */
export const MODEL_PATTERN = /^gemini-[a-z0-9.-]{1,40}$/;

/**
 * @param {string} model
 * @returns {boolean}
 */
export const isValidModel = (model) => MODEL_PATTERN.test(model);
