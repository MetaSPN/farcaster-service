import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DEFAULT_STATE_PATH = new URL('../../.farcaster-state.json', import.meta.url).pathname;
const DEFAULT_HISTORY_SIZE = 50;

export class State {
  constructor(opts = {}) {
    this.path = opts.path || process.env.FARCASTER_STATE_PATH || DEFAULT_STATE_PATH;
    this.historySize = opts.historySize || DEFAULT_HISTORY_SIZE;
    this._load();
  }

  _load() {
    try {
      this.data = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch {
      this.data = { casts: [], cooldowns: {}, rateWindows: [] };
    }
    // Ensure structure
    this.data.casts ??= [];
    this.data.cooldowns ??= {};
    this.data.rateWindows ??= [];
  }

  _save() {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
    } catch {}
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  // Record a cast we sent
  recordCast(text, hash, opts = {}) {
    this.data.casts.unshift({
      text,
      hash,
      timestamp: Date.now(),
      channel: opts.channel || null,
      replyTo: opts.replyTo || null,
    });
    // Trim history
    if (this.data.casts.length > this.historySize) {
      this.data.casts = this.data.casts.slice(0, this.historySize);
    }
    this.data.rateWindows.push(Date.now());
    this._save();
  }

  // Check if text is a duplicate of recent casts
  isDuplicate(text, windowMs = 3600000) {
    const cutoff = Date.now() - windowMs;
    const normalized = text.trim().toLowerCase();
    return this.data.casts.some(
      c => c.timestamp > cutoff && c.text.trim().toLowerCase() === normalized
    );
  }

  // Get recent cast texts
  recentCasts(n = 10) {
    return this.data.casts.slice(0, n);
  }

  // Per-target cooldown
  setCooldown(targetKey, durationMs) {
    this.data.cooldowns[targetKey] = Date.now() + durationMs;
    this._save();
  }

  isOnCooldown(targetKey) {
    const until = this.data.cooldowns[targetKey];
    if (!until) return false;
    if (Date.now() >= until) {
      delete this.data.cooldowns[targetKey];
      this._save();
      return false;
    }
    return true;
  }

  // Rate window: count casts in last N ms
  castsInWindow(windowMs) {
    const cutoff = Date.now() - windowMs;
    // Clean old entries
    this.data.rateWindows = this.data.rateWindows.filter(t => t > cutoff);
    return this.data.rateWindows.length;
  }
}
