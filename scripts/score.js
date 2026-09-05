import { claudeEnabled, scoreArticles, summarizeCard } from '../lib/claude.js';
import { titleOverlapRatio } from '../lib/util.js';

const SHORTLIST = 40;

function keywordScore(interest, article) {
  const haystack = `${article.title} ${article.summary}`.toLowerCase();
  let hits = 0;
  let titleHits = 0;
  for (const keyword of interest.keywords) {
    const needle = keyword.toLowerCase();
    if (!haystack.includes(needle)) continue;
    hits++;
    if (article.title.toLowerCase().includes(needle)) titleHits++;
  }
  const base = Math.min(6, hits * 1.5 + titleHits * 1.5);
  const ageHours = article.publishedAt
    ? (Date.now() - article.publishedAt.getTime()) / 3600000
    : 48;
  const freshness = Math.max(0, 1.5 - ageHours / 48);
  return Math.round((base + freshness) * 10) / 10;
}

export async function score(config, articles, log = console.log) {
  const cards = [];

  for (const interest of config.interests) {
    const pool = articles
      .filter((article) => article.candidates.includes(interest.id))
      .map((article) => ({ ...article, score: keywordScore(interest, article) }))
      .sort((a, b) => b.score - a.score);

    let ranked = pool;
    let scoredBy = 'keyword';

    if (claudeEnabled() && pool.length > 0) {
      const shortlist = pool.slice(0, SHORTLIST);
      try {
        const scores = await scoreArticles(interest, shortlist);
        if (scores.size > 0) {
          ranked = shortlist
            .map((article, index) => ({
              ...article,
              score: scores.has(index) ? scores.get(index) : article.score
            }))
            .sort((a, b) => b.score - a.score);
          scoredBy = 'claude';
        }
      } catch (error) {
        log(`  ! ${interest.label} 점수 매기기 실패, 키워드 점수로 대체: ${error.message}`);
      }
    }

    const minScore = config.site.minScore ?? 3;
    const passing = ranked.filter((article) => article.score >= minScore);
    const items = [];
    let skippedSimilar = 0;
    for (const article of passing) {
      if (items.length >= config.site.itemsPerCard) break;
      const tooSimilar = items.some((picked) => titleOverlapRatio(picked.title, article.title) > 0.5);
      if (tooSimilar) {
        skippedSimilar += 1;
        continue;
      }
      items.push(article);
    }
    let summary = '';

    if (config.site.summaryEnabled && interest.showSummary && claudeEnabled() && items.length >= 2) {
      try {
        summary = await summarizeCard(interest, items);
      } catch (error) {
        log(`  ! ${interest.label} 요약 실패: ${error.message}`);
      }
    }

    cards.push({
      id: interest.id,
      label: interest.label,
      icon: interest.icon,
      keywords: interest.keywords.slice(0, 3),
      summary,
      scoredBy,
      poolSize: pool.length,
      items
    });

    const cut = ranked.length - passing.length;
    const extras = [
      cut ? `${minScore}점 미만 ${cut}건 제외` : '',
      skippedSimilar ? `유사 제목 ${skippedSimilar}건 건너뜀` : ''
    ].filter(Boolean);
    log(`  ${interest.label}: 후보 ${pool.length}건 → ${items.length}건 선정 (${scoredBy}${extras.length ? `, ${extras.join(', ')}` : ''})`);
  }

  return cards;
}
