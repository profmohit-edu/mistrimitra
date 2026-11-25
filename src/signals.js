/**
 * Small live signals shown on screen: response latency per turn and the
 * language the technician is speaking.
 * @module signals
 */
import { END_OF_SPEECH_MS, SPEECH_RMS } from './config.js';

/**
 * Measures the time from the end of the technician's speech (or a typed
 * message) to the first audio of the reply.
 */
export class LatencyMeter {
  constructor() {
    /** @type {number | null} */
    this.lastSpeech = null;
    /** @type {number | null} */
    this.turnEnd = null;
    this.waiting = false;
  }

  /** Feed microphone levels. @param {number} level @param {number} now ms */
  level(level, now) {
    if (level >= SPEECH_RMS) {
      this.lastSpeech = now;
      this.waiting = true;
      this.turnEnd = null;
    } else if (
      this.waiting &&
      this.lastSpeech !== null &&
      this.turnEnd === null &&
      now - this.lastSpeech >= END_OF_SPEECH_MS
    ) {
      this.turnEnd = this.lastSpeech;
    }
  }

  /** A typed message ends the turn immediately. @param {number} now ms */
  typed(now) {
    this.turnEnd = now;
    this.waiting = true;
  }

  /**
   * Call on each reply audio chunk; returns the latency in ms for the first
   * chunk of a turn, otherwise null.
   * @param {number} now ms
   */
  reply(now) {
    if (!this.waiting || this.turnEnd === null) {
      return null;
    }
    this.waiting = false;
    return Math.max(0, Math.round(now - this.turnEnd));
  }
}

const HINGLISH_WORDS = /\b(hai|kya|nahi|kar|karo|raha|rahi|aa|pe|ka|ki|ke|haan|theek|bana|do|ho|gaya|awaaz|garam)\b/i;

/**
 * Best-guess label for the language of a transcript fragment.
 * @param {string} text
 * @returns {string}
 */
export function detectLanguage(text) {
  if (/[ऀ-ॿ]/.test(text)) {
    return /(आहे|नाही|काय|नको)/.test(text) ? 'Marathi' : 'Hindi';
  }
  if (/[஀-௿]/.test(text)) {
    return 'Tamil';
  }
  if (/[ఀ-౿]/.test(text)) {
    return 'Telugu';
  }
  if (/[ঀ-৿]/.test(text)) {
    return 'Bengali';
  }
  return HINGLISH_WORDS.test(text) ? 'Hinglish' : 'English';
}
