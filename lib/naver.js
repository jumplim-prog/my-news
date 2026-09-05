import { clean, normalizeUrl, parseDate, withTimeout } from './util.js';

const ENDPOINT = 'https://openapi.naver.com/v1/search/news.json';

export function naverEnabled() {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

function outletFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^(www|news|m)\./, '');
    return host.split('.')[0];
  } catch {
    return '출처 미상';
  }
}

export async function searchNaver(query, { display = 20, timeoutMs = 12000 } = {}) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=${display}&sort=date`;

  const response = await withTimeout(
    (signal) => fetch(url, {
      signal,
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
      }
    }),
    timeoutMs,
    `네이버 검색: ${query}`
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  return (data.items || []).map((item) => {
    const link = normalizeUrl(item.originallink || item.link);
    return {
      title: clean(item.title),
      link,
      summary: clean(item.description, 200),
      publishedAt: parseDate(item.pubDate),
      image: '',
      sourceName: outletFromUrl(link)
    };
  }).filter((item) => item.title && /^https?:/i.test(item.link));
}
