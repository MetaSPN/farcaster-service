import { State } from './state.mjs';

// BIP-39 first words (subset for detection)
const BIP39_COMMON = new Set([
  'abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse',
  'access','accident','account','accuse','achieve','acid','acoustic','acquire','across','act',
  'action','actor','actress','actual','adapt','add','addict','address','adjust','admit',
  'adult','advance','advice','aerobic','affair','afford','afraid','again','age','agent',
  'agree','ahead','aim','air','airport','aisle','alarm','album','alcohol','alert',
  'alien','all','alley','allow','almost','alone','alpha','already','also','alter',
  'always','amateur','amazing','among','amount','amused','analyst','anchor','ancient','anger',
  'angle','angry','animal','ankle','announce','annual','another','answer','antenna','antique',
  'anxiety','any','apart','apology','appear','apple','approve','april','arch','arctic',
  'area','arena','argue','arm','armed','armor','army','around','arrange','arrest',
  'arrive','arrow','art','artefact','artist','artwork','ask','aspect','assault','asset',
  'assist','assume','asthma','athlete','atom','attack','attend','attitude','attract','auction',
  'audit','august','aunt','author','auto','autumn','average','avocado','avoid','awake','awkward',
  'baby','bachelor','bacon','badge','bag','balance','balcony','ball','bamboo','banana','banner',
  'bar','barely','bargain','barrel','base','basic','basket','battle','beach','bean','beauty',
  'because','become','beef','before','begin','behave','behind','believe','below','belt',
  'bench','benefit','best','betray','better','between','beyond','bicycle','bid','bike','bind',
  'biology','bird','birth','bitter','black','blade','blame','blanket','blast','bleak','bless',
  'blind','blood','blossom','blow','blue','blur','blush','board','boat','body','boil','bomb',
  'bone','bonus','book','boost','border','boring','borrow','boss','bottom','bounce','box',
  'boy','bracket','brain','brand','brass','brave','bread','breeze','brick','bridge','brief',
  'bright','bring','brisk','broccoli','broken','bronze','broom','brother','brown','brush',
  'bubble','buddy','budget','buffalo','build','bulb','bulk','bullet','bundle','bunny','burden',
  'burger','burst','bus','business','busy','butter','buyer','buzz','cabbage','cabin','cable',
  'cactus','cage','cake','call','calm','camera','camp','can','canal','cancel','candy','cannon',
  'canoe','canvas','canyon','capable','capital','captain','car','carbon','card','cargo','carpet',
  'carry','cart','case','cash','casino','castle','casual','cat','catalog','catch','category',
  'cattle','caught','cause','caution','cave','ceiling','celery','cement','census','century',
  'cereal','certain','chair','chalk','champion','change','chaos','chapter','charge','chase',
  'cheap','check','cheese','chef','cherry','chest','chicken','chief','child','chimney','choice',
  'choose','chronic','chuckle','chunk','churn','citizen','city','civil','claim','clap','clarify',
  'claw','clay','clean','clerk','clever','cliff','climb','clinic','clip','clock','clog','close',
  'cloth','cloud','clown','club','clump','cluster','clutch','coach','coast','coconut','code',
  'coffee','coil','coin','collect','color','column','combine','come','comfort','comic','common',
  'company','concert','conduct','confirm','congress','connect','consider','control','convince',
  'cook','cool','copper','copy','coral','core','corn','correct','cost','cotton','couch','country',
  'couple','course','cousin','cover','coyote','crack','cradle','craft','cram','crane','crash',
  'crater','crawl','crazy','cream','credit','creek','crew','cricket','crime','crisp','critic',
  'crop','cross','crouch','crowd','crucial','cruel','cruise','crumble','crush','cry','crystal',
  'cube','culture','cup','cupboard','curious','current','curtain','curve','cushion','custom','cute','cycle',
  'dad','damage','damp','dance','danger','daring','dash','daughter','dawn','day','deal','debate',
  'debris','decade','december','decide','decline','decorate','decrease','deer','defense','define',
  'defy','degree','delay','deliver','demand','demise','denial','dentist','deny','depart','depend',
  'deposit','depth','deputy','derive','describe','desert','design','desk','despair','destroy','detail',
  'detect','develop','device','devote','diagram','dial','diamond','diary','dice','diesel','diet',
  'differ','digital','dignity','dilemma','dinner','dinosaur','direct','dirt','disagree','discover',
  'disease','dish','dismiss','disorder','display','distance','divert','divide','divorce','dizzy',
  'doctor','document','dog','doll','dolphin','domain','donate','donkey','donor','door','dose',
  'double','dove','draft','dragon','drama','drastic','draw','dream','dress','drift','drill',
  'drink','drip','drive','drop','drum','dry','duck','dumb','dune','during','dust','dutch','duty','dwarf','dynamic',
]);

const SPAM_PATTERNS = [
  /free\s+(airdrop|nft|token|mint)/i,
  /claim\s+(your|free|now)/i,
  /send\s+\d+\s*(eth|sol|btc|usdc)/i,
  /dm\s+(me|for)\s+(alpha|whitelist|wl)/i,
  /100x\s+gem/i,
  /guaranteed\s+(profit|return|gain)/i,
  /not\s+financial\s+advice.*buy/i,
  /double\s+your\s+(money|crypto|eth)/i,
  /limited\s+spots?\s+(left|remaining)/i,
  /act\s+(fast|now|quick)/i,
];

const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // CC
  /\b[A-Z]{1,2}\d{6,9}\b/, // passport-ish
];

const PRIVATE_KEY_PATTERN = /^(0x)?[a-f0-9]{64}$/i;
const HEX_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/i;
const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;

function looksLikeSeedPhrase(text) {
  const words = text.trim().toLowerCase().split(/\s+/);
  if (words.length < 12 || words.length > 24) return false;
  const matches = words.filter(w => BIP39_COMMON.has(w)).length;
  return matches / words.length > 0.8;
}

/**
 * Validate a cast before sending. Returns { ok, reason? }
 */
export function validateCast(text, state) {
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'Cast text is empty or not a string' };
  }

  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: false, reason: 'Cast text is empty after trimming' };
  }

  // Byte length check (Farcaster limit is 320 bytes)
  if (Buffer.byteLength(trimmed, 'utf8') > 320) {
    return { ok: false, reason: `Cast exceeds 320 bytes (${Buffer.byteLength(trimmed, 'utf8')} bytes)` };
  }

  // Hex address only
  if (HEX_ADDRESS_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'Cast is just a hex address — this is almost certainly a bug' };
  }

  // Private key pattern
  if (PRIVATE_KEY_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'Cast looks like a private key — BLOCKED for safety' };
  }

  // Seed phrase detection
  if (looksLikeSeedPhrase(trimmed)) {
    return { ok: false, reason: 'Cast looks like a seed phrase — BLOCKED for safety' };
  }

  // URL-only (no commentary)
  if (URL_ONLY_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'Cast is just a URL with no commentary — add some text' };
  }

  // Spam patterns
  for (const pat of SPAM_PATTERNS) {
    if (pat.test(trimmed)) {
      return { ok: false, reason: `Cast matches spam pattern: ${pat}` };
    }
  }

  // Dedup check
  if (state && state.isDuplicate(trimmed)) {
    return { ok: false, reason: 'Duplicate of a recent cast (within last hour)' };
  }

  return { ok: true };
}

/**
 * Content filter for PII and slurs
 */
export function contentFilter(text) {
  if (!text) return { ok: true };

  for (const pat of PII_PATTERNS) {
    if (pat.test(text)) {
      return { ok: false, reason: 'Cast appears to contain PII (SSN, CC, passport number)' };
    }
  }

  return { ok: true };
}

/**
 * Rate limiter. Returns { ok, reason? }
 */
export function checkRateLimit(state, config = {}) {
  const {
    maxPerHour = 30,
    minIntervalMs = 30000, // 30s between casts
  } = config;

  if (!state) return { ok: true };

  const castsLastHour = state.castsInWindow(3600000);
  if (castsLastHour >= maxPerHour) {
    return { ok: false, reason: `Rate limit: ${castsLastHour}/${maxPerHour} casts in the last hour` };
  }

  const recent = state.recentCasts(1);
  if (recent.length > 0) {
    const elapsed = Date.now() - recent[0].timestamp;
    if (elapsed < minIntervalMs) {
      return { ok: false, reason: `Cooldown: wait ${Math.ceil((minIntervalMs - elapsed) / 1000)}s before next cast` };
    }
  }

  return { ok: true };
}

/**
 * Run all guards. Returns { ok, reason? }
 */
export function runAllGuards(text, state, rateConfig = {}) {
  const checks = [
    validateCast(text, state),
    contentFilter(text),
    checkRateLimit(state, rateConfig),
  ];

  for (const check of checks) {
    if (!check.ok) return check;
  }

  return { ok: true };
}
