const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '\u201c', rdquo: '\u201d', lsquo: '\u2018', rsquo: '\u2019',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', middot: '\u00b7'
};

export function decodeEntities(input) {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function stripTags(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

export function clean(text, maxLength = 0) {
  let out = decodeEntities(stripTags(String(text ?? '')))
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLength > 0 && out.length > maxLength) {
    out = out.slice(0, maxLength).trimEnd() + '\u2026';
  }
  return out;
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);
  if (compact) {
    const [, y, m, d, hh = '00', mm = '00'] = compact;
    const built = new Date(`${y}-${m}-${d}T${hh}:${mm}:00+09:00`);
    if (!Number.isNaN(built.getTime())) return built;
  }
  return null;
}

export function relativeTime(date, now = new Date()) {
  if (!date) return '';
  const minutes = Math.floor((now - date) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일전`;
  const months = Math.floor(days / 30);
  return `${months}개월전`;
}

export function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|source|plink|from)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export function titleKey(title) {
  return clean(title)
    .toLowerCase()
    .replace(/^\[[^\]]{0,12}\]\s*/, '')
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
    .slice(0, 40);
}

export function titleWordSet(title) {
  return new Set(
    clean(title)
      .toLowerCase()
      .split(/[^\p{Letter}\p{Number}]+/u)
      .filter((word) => word.length >= 2 && !/\d/.test(word))
  );
}

export function titleOverlapRatio(titleA, titleB) {
  const left = titleWordSet(titleA);
  const right = titleWordSet(titleB);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) {
    if (right.has(word)) shared += 1;
  }
  return shared / Math.min(left.size, right.size);
}

export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function withTimeout(promiseFactory, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promiseFactory(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${label} 시간 초과 (${ms}ms)`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
