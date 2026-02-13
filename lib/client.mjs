import { readFileSync } from 'fs';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import {
  makeCastAdd,
  NobleEd25519Signer,
  FarcasterNetwork,
  Message,
} from '@farcaster/hub-nodejs';
import { runAllGuards } from './guards.mjs';
import { State } from './state.mjs';

// Setup noble ed25519
ed.hashes ??= {};
ed.hashes.sha512 = (...msgs) => sha512(ed.etc.concatBytes(...msgs));

const NEYNAR_API = 'https://api.neynar.com/v2/farcaster';
const HUB_SUBMIT = 'https://hub-api.neynar.com/v1/submitMessage';

export class FarcasterClient {
  constructor(opts = {}) {
    const signerPath = opts.signerPath || process.env.SIGNER_KEY_PATH || `${process.env.HOME}/.marvin/secrets/farcaster-signer.json`;
    const config = JSON.parse(readFileSync(signerPath, 'utf8'));

    this.fid = opts.fid || parseInt(process.env.FARCASTER_FID) || config.fid;
    this.apiKey = opts.apiKey || process.env.NEYNAR_API_KEY || readFileSync(`${process.env.HOME}/.marvin/secrets/neynar-api-key`, 'utf8').trim();
    this.state = new State(opts.state);
    this.rateConfig = opts.rateConfig || {};
    this.guardsEnabled = opts.guards !== false;

    const privateKeyBytes = Buffer.from(config.signerPrivateKey.slice(2), 'hex');
    this._signer = new NobleEd25519Signer(privateKeyBytes);
  }

  _headers() {
    return { accept: 'application/json', api_key: this.apiKey };
  }

  async _neynar(path, params = {}) {
    const url = new URL(`${NEYNAR_API}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
    const resp = await fetch(url, { headers: this._headers(), signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`Neynar ${path}: ${resp.status} ${await resp.text()}`);
    return resp.json();
  }

  /**
   * Post a cast. Guards are enforced by default.
   */
  async cast(text, opts = {}) {
    if (this.guardsEnabled) {
      const check = runAllGuards(text, this.state, this.rateConfig);
      if (!check.ok) {
        return { ok: false, reason: check.reason };
      }
    }

    const castBody = {
      text,
      embeds: (opts.embeds || []).map(url => ({ url })),
      embedsDeprecated: [],
      mentions: opts.mentions || [],
      mentionsPositions: opts.mentionPositions || [],
    };

    if (opts.channel) {
      castBody.parentUrl = `https://warpcast.com/~/channel/${opts.channel}`;
    }

    if (opts.replyHash && opts.replyFid) {
      castBody.parentCastId = {
        fid: opts.replyFid,
        hash: Uint8Array.from(Buffer.from(opts.replyHash.replace('0x', ''), 'hex')),
      };
    }

    const result = await makeCastAdd(
      castBody,
      { fid: this.fid, network: FarcasterNetwork.MAINNET },
      this._signer,
    );

    if (result.isErr()) {
      return { ok: false, reason: `Cast creation failed: ${result.error}` };
    }

    const messageBytes = Buffer.from(Message.encode(result.value).finish());
    const resp = await fetch(HUB_SUBMIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'x-api-key': this.apiKey },
      body: messageBytes,
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, reason: `Hub submit failed: ${resp.status} ${body}` };
    }

    const data = await resp.json();
    this.state.recordCast(text, data.hash, {
      channel: opts.channel,
      replyTo: opts.replyHash,
    });

    return { ok: true, hash: data.hash, data };
  }

  /**
   * Reply to a cast (convenience wrapper)
   */
  async reply(hash, fid, text, opts = {}) {
    return this.cast(text, { ...opts, replyHash: hash, replyFid: fid });
  }

  /**
   * Search casts via Neynar
   */
  async search(query, opts = {}) {
    const data = await this._neynar('/cast/search', {
      q: query,
      limit: opts.limit || 25,
    });
    let casts = data.result?.casts || [];

    if (opts.minFollowers) {
      casts = casts.filter(c => (c.author?.follower_count || 0) >= opts.minFollowers);
    }

    if (opts.maxAge) {
      const maxMs = parseAge(opts.maxAge);
      const cutoff = Date.now() - maxMs;
      casts = casts.filter(c => new Date(c.timestamp).getTime() > cutoff);
    }

    return casts;
  }

  /**
   * Get notifications
   */
  async notifications(fid, limit = 25) {
    const data = await this._neynar('/notifications', { fid: fid || this.fid, limit });
    return data.notifications || [];
  }

  /**
   * Get user profile by FID
   */
  async user(fid) {
    const data = await this._neynar('/user/bulk', { fids: fid });
    return data.users?.[0] || null;
  }

  /**
   * Lookup user by username
   */
  async userByName(username) {
    const data = await this._neynar('/user/by_username', { username });
    return data.user || null;
  }

  /**
   * Get user's casts
   */
  async feed(fid, limit = 25) {
    const data = await this._neynar('/feed/user/casts', { fid, limit });
    return data.casts || [];
  }

  /**
   * Trending casts in a channel
   */
  async trending(channel, limit = 25) {
    const params = { limit, time_window: '24h' };
    if (channel) params.channel_id = channel;
    const data = await this._neynar('/feed/trending', params);
    return data.casts || [];
  }

  /**
   * Get full thread
   */
  async thread(hash) {
    const data = await this._neynar('/cast/conversation', {
      identifier: hash,
      type: 'hash',
      reply_depth: 5,
      include_chronological_parent_casts: true,
    });
    return data.conversation || null;
  }
}

function parseAge(str) {
  const match = str.match(/^(\d+)(m|h|d)$/);
  if (!match) return 86400000; // default 24h
  const n = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'm') return n * 60000;
  if (unit === 'h') return n * 3600000;
  if (unit === 'd') return n * 86400000;
  return 86400000;
}
