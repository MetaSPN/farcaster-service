#!/usr/bin/env node
import { FarcasterClient } from './lib/client.mjs';

const args = process.argv.slice(2);
const command = args[0];
const pretty = args.includes('--pretty');

function getFlag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

function out(data) {
  console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
}

if (!command || command === '--help') {
  console.log(`Usage:
  node cli.mjs cast "text" [--channel X] [--reply hash:fid] [--embed url]
  node cli.mjs search "query" [--min-followers 100] [--max-age 6h] [--limit 25]
  node cli.mjs notifications [--limit 10]
  node cli.mjs user <fid-or-username>
  node cli.mjs feed <fid-or-username> [--limit 5]
  node cli.mjs thread <hash>
  
Options:
  --pretty    Pretty-print JSON output`);
  process.exit(0);
}

const client = new FarcasterClient();

try {
  switch (command) {
    case 'cast': {
      const text = args[1];
      if (!text) { console.error('Error: cast text required'); process.exit(1); }
      const opts = {};
      const channel = getFlag('channel');
      if (channel) opts.channel = channel;
      const reply = getFlag('reply');
      if (reply) {
        const [hash, fid] = reply.split(':');
        opts.replyHash = hash;
        opts.replyFid = parseInt(fid);
      }
      const embed = getFlag('embed');
      if (embed) opts.embeds = [embed];
      const result = await client.cast(text, opts);
      out(result);
      if (!result.ok) process.exit(1);
      break;
    }

    case 'search': {
      const query = args[1];
      if (!query) { console.error('Error: search query required'); process.exit(1); }
      const opts = {};
      const limit = getFlag('limit');
      if (limit) opts.limit = parseInt(limit);
      const minF = getFlag('min-followers');
      if (minF) opts.minFollowers = parseInt(minF);
      const maxAge = getFlag('max-age');
      if (maxAge) opts.maxAge = maxAge;
      out(await client.search(query, opts));
      break;
    }

    case 'notifications': {
      const limit = getFlag('limit');
      out(await client.notifications(null, limit ? parseInt(limit) : 25));
      break;
    }

    case 'user': {
      const target = args[1];
      if (!target) { console.error('Error: fid or username required'); process.exit(1); }
      const isNum = /^\d+$/.test(target);
      out(isNum ? await client.user(target) : await client.userByName(target));
      break;
    }

    case 'feed': {
      const target = args[1];
      if (!target) { console.error('Error: fid or username required'); process.exit(1); }
      const limit = getFlag('limit');
      let fid = target;
      if (!/^\d+$/.test(target)) {
        const u = await client.userByName(target);
        fid = u?.fid;
        if (!fid) { console.error(`User not found: ${target}`); process.exit(1); }
      }
      out(await client.feed(fid, limit ? parseInt(limit) : 25));
      break;
    }

    case 'thread': {
      const hash = args[1];
      if (!hash) { console.error('Error: cast hash required'); process.exit(1); }
      out(await client.thread(hash));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
