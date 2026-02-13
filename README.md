# farcaster-service

[![Node.js 20+](https://img.shields.io/badge/node-20%2B-green)](https://nodejs.org) [![ESM](https://img.shields.io/badge/type-ESM-blue)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) [![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

Guarded Farcaster client for AI agents. Post, search, reply, and engage — with safety rails that prevent spam, duplicates, and leaked secrets.

## Quick Start

```bash
npm install
cp .env.example .env  # edit with your keys
node cli.mjs cast "Hello Farcaster!"
```

## Features

- **Cast, reply, search, notifications, feed, thread** — full Farcaster API
- **Guards by default** — hex address detection, key leak prevention, spam filters, dedup, rate limiting, PII detection
- **State tracking** — persistent JSON state prevents duplicates across sessions
- **CLI + Library** — use from shell or import into your agent

## Library

```javascript
import { FarcasterClient } from './lib/client.mjs';

const client = new FarcasterClient();

// Post (guards enforced automatically)
const result = await client.cast("Thinking about decentralized social...");
if (!result.ok) console.error(result.reason);

// Search
const casts = await client.search("AI agents", { limit: 10, minFollowers: 100 });

// Reply
await client.reply("0xabc123", 12345, "Great point!");

// User lookup
const user = await client.userByName("dwr.eth");
```

## Migration from cast.mjs

Before:
```bash
node ~/clawd/farcaster/cast.mjs "text" --reply 0xabc:123 --channel ai
```

After:
```bash
node ~/clawd/farcaster-service/cli.mjs cast "text" --reply 0xabc:123 --channel ai
```

Same flags, same behavior — plus guards, dedup, and rate limiting.

## Guards

Every outbound cast is validated against:
- Bare hex addresses (the bug that inspired this project)
- Private keys and seed phrases
- URL-only casts (no commentary)
- 320-byte Farcaster limit
- Spam patterns (airdrops, "claim now", etc.)
- PII (SSN, credit cards)
- Duplicate detection (1-hour window)
- Rate limiting (30/hour, 30s cooldown)

## License

MIT
