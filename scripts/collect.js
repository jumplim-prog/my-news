import { fetchFeed } from '../lib/rss.js';
import { naverEnabled, searchNaver } from '../lib/naver.js';
import { interestMaxAgeHours, isWithinMaxAge, titleKey } from '../lib/util.js';

const CONCURRENCY = 6;

async function pooled(items, worker, limit = CONCURRENCY) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function collect(config, sourceConfig) {
  const collectHours = Math.max(
    ...config.interests.map((interest) => interestMaxAgeHours(interest, config.site)),
    config.site.maxAgeHours ?? 72
  );
  const validIds = new Set(config.interests.map((i) => i.id));
  const collected = [];
  const report = { ok: [], failed: [] };

  const sources = sourceConfig.sources.filter((source) => {
    const targets = source.interests.filter((id) => validIds.has(id));
    return targets.length > 0;
  });

  await pooled(sources, async (source) => {
    try {
      const items = await fetchFeed(source);
      let kept = 0;
      for (const item of items) {
        if (!isWithinMaxAge(item, collectHours)) continue;
        collected.push({
          ...item,
          sourceName: source.name,
          sourceId: source.id,
          candidates: source.interests.filter((id) => validIds.has(id))
        });
        kept++;
      }
      report.ok.push(`${source.name} (${source.id}): ${kept}건`);
    } catch (error) {
      report.failed.push(`${source.name} (${source.id}): ${error.message}`);
    }
  });

  if (naverEnabled()) {
    const jobs = [];
    for (const interest of config.interests) {
      for (const query of interest.naverQueries || []) {
        jobs.push({ interest, query });
      }
    }
    await pooled(jobs, async ({ interest, query }) => {
      try {
        const items = await searchNaver(query);
        let kept = 0;
        for (const item of items) {
          if (!isWithinMaxAge(item, collectHours)) continue;
          collected.push({
            ...item,
            sourceId: `naver:${query}`,
            candidates: [interest.id]
          });
          kept++;
        }
        report.ok.push(`네이버 "${query}": ${kept}건`);
      } catch (error) {
        report.failed.push(`네이버 "${query}": ${error.message}`);
      }
    }, 3);
  } else {
    report.failed.push('네이버 검색 API: 키가 없어 건너뜀 (선택 사항)');
  }

  const byKey = new Map();
  for (const article of collected) {
    const key = titleKey(article.title) || article.link;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, article);
      continue;
    }
    existing.candidates = [...new Set([...existing.candidates, ...article.candidates])];
    if (!existing.image && article.image) existing.image = article.image;
    if (!existing.summary && article.summary) existing.summary = article.summary;
    if (!existing.publishedAt && article.publishedAt) existing.publishedAt = article.publishedAt;
  }

  const articles = [...byKey.values()].sort(
    (a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0)
  );

  return { articles, report };
}
