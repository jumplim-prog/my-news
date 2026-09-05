import { clean, decodeEntities, normalizeUrl, parseDate, withTimeout } from './util.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; MyNewsBot/1.0; personal reader)';

function pickBlocks(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

function pickText(block, ...tags) {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
    const match = block.match(re);
    if (match) {
      const inner = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      const text = inner.trim();
      if (text) return text;
    }
  }
  return '';
}

function pickAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const match = block.match(re);
  return match ? decodeEntities(match[1]) : '';
}

function pickLink(block) {
  const plain = pickText(block, 'link');
  if (plain && !plain.startsWith('<')) return plain;
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alternate) return decodeEntities(alternate[1]);
  const anyHref = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  if (anyHref) return decodeEntities(anyHref[1]);
  return pickText(block, 'guid');
}

function pickImage(block) {
  const enclosure = block.match(/<enclosure\b[^>]*type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i)
    || block.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']*["']/i);
  if (enclosure) return decodeEntities(enclosure[1]);

  const media = pickAttr(block, 'media:content', 'url')
    || pickAttr(block, 'media:thumbnail', 'url')
    || pickAttr(block, 'image', 'url');
  if (media && /^https?:/i.test(media)) return media;

  const imageTag = pickText(block, 'image');
  if (imageTag && /^https?:\/\//i.test(imageTag.trim())) return imageTag.trim();

  const inline = block.match(/<img\b[^>]*src=["']([^"']+)["']/i);
  if (inline) return decodeEntities(inline[1]);

  const escaped = block.match(/&lt;img[^&]*src=(?:&quot;|')([^&']+)/i);
  if (escaped) return decodeEntities(escaped[1]);

  return '';
}

export function parseFeed(xml) {
  const blocks = [...pickBlocks(xml, 'item'), ...pickBlocks(xml, 'entry')];
  const items = [];

  for (const block of blocks) {
    const title = clean(pickText(block, 'title'));
    const link = normalizeUrl(clean(pickLink(block)));
    if (!title || !link || !/^https?:/i.test(link)) continue;

    items.push({
      title,
      link,
      summary: clean(pickText(block, 'description', 'summary', 'content:encoded', 'content'), 200),
      publishedAt: parseDate(
        pickText(block, 'pubDate', 'published', 'updated', 'dc:date', 'date')
      ),
      image: pickImage(block)
    });
  }
  return items;
}

export async function fetchFeed(source, { timeoutMs = 15000 } = {}) {
  const response = await withTimeout(
    (signal) => fetch(source.url, {
      signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml, text/xml, */*' }
    }),
    timeoutMs,
    source.name
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const head = buffer.subarray(0, 400).toString('latin1');
  const charset = head.match(/encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase() || 'utf-8';

  let xml;
  if (/euc-kr|ks_c_5601|cp949/.test(charset)) {
    xml = new TextDecoder('euc-kr').decode(buffer);
  } else {
    xml = buffer.toString('utf8');
  }

  const items = parseFeed(xml);
  if (items.length === 0) throw new Error('항목을 찾지 못함 (RSS 형식이 아닐 수 있음)');
  return items;
}
