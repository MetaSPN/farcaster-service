# Farcaster Service — OpenClaw Skill

Post, search, and interact on Farcaster with built-in safety guards that prevent spam, duplicates, leaked keys, and the dreaded "accidentally posting a hex address" bug.

## Setup

```bash
cd ~/clawd/farcaster-service
npm install
```

Required secrets:
- Farcaster signer JSON at `~/.marvin/secrets/farcaster-signer.json` (contains `signerPrivateKey` and `fid`)
- Neynar API key at `~/.marvin/secrets/neynar-api-key` (or set `NEYNAR_API_KEY` env var)

## CLI Commands

All output is JSON. Add `--pretty` for formatted output.

### Post a cast
```bash
node ~/clawd/farcaster-service/cli.mjs cast "Hello Farcaster!"
node ~/clawd/farcaster-service/cli.mjs cast "Great thread!" --reply 0xabc123:12345
node ~/clawd/farcaster-service/cli.mjs cast "Check this out" --channel ai --embed https://example.com
```

### Search casts
```bash
node ~/clawd/farcaster-service/cli.mjs search "AI agents" --limit 10 --min-followers 100 --max-age 6h
```

### Notifications
```bash
node ~/clawd/farcaster-service/cli.mjs notifications --limit 10
```

### User lookup
```bash
node ~/clawd/farcaster-service/cli.mjs user 1103255
node ~/clawd/farcaster-service/cli.mjs user dwr.eth
```

### User feed
```bash
node ~/clawd/farcaster-service/cli.mjs feed dwr.eth --limit 5
```

### Thread
```bash
node ~/clawd/farcaster-service/cli.mjs thread 0xabc123
```

## Guard System

Every outbound cast passes through these checks automatically:

| Guard | What it catches |
|-------|----------------|
| Hex address | Bare `0x...` addresses (the bug that started this) |
| Private keys | 64-char hex strings that look like private keys |
| Seed phrases | 12-24 word sequences matching BIP-39 wordlist |
| URL-only | Links with no commentary |
| Byte limit | Casts exceeding Farcaster's 320-byte limit |
| Spam patterns | "free airdrop", "claim now", "100x gem", etc. |
| PII | SSNs, credit card numbers, passport numbers |
| Dedup | Duplicate of any cast sent in the last hour |
| Rate limit | Max 30 casts/hour, 30s cooldown between casts |

Guards cannot be bypassed through the CLI. When using the library directly, pass `guards: false` to the constructor (not recommended).

## Library Usage

```javascript
import { FarcasterClient } from './lib/client.mjs';

const client = new FarcasterClient();
const result = await client.cast("Hello from my agent!");
// { ok: true, hash: "0x..." }
// or { ok: false, reason: "Cast is just a hex address — this is almost certainly a bug" }
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `NEYNAR_API_KEY` | reads from secrets file | Neynar API key |
| `FARCASTER_FID` | from signer JSON | Your Farcaster FID |
| `SIGNER_KEY_PATH` | `~/.marvin/secrets/farcaster-signer.json` | Path to signer credentials |
| `FARCASTER_STATE_PATH` | `.farcaster-state.json` | State file for dedup/rate limiting |
