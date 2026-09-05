import { mkdir, writeFile } from 'node:fs/promises';
import { escapeHtml, relativeTime } from '../lib/util.js';

const ICONS = {
  chart: 'M3 3v18h18M7 15l4-5 3 3 5-7',
  flower: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 8V4M12 20v-4M8 12H4M20 12h-4M9.2 9.2 6.3 6.3M17.7 17.7l-2.9-2.9M14.8 9.2l2.9-2.9M6.3 17.7l2.9-2.9',
  book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22zM8 7h8M8 11h5',
  palette: 'M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.2-1.8 4-4 4h-2a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21M7.5 10.5h.01M10.5 7.5h.01M14.5 7.5h.01',
  refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  dot: 'M12 12h.01'
};

const REFRESH_HOURS_KST = [6, 12, 18];

function kstHourMinute(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour').value);
  const minute = Number(parts.find((part) => part.type === 'minute').value);
  return { hour: hour === 24 ? 0 : hour, minute };
}

export function nextRefreshLabel(builtAt) {
  const { hour, minute } = kstHourMinute(builtAt);
  const hm = hour * 60 + minute;
  const nextHour = REFRESH_HOURS_KST.find((h) => hm < h * 60) ?? REFRESH_HOURS_KST[0];
  return `${String(nextHour).padStart(2, '0')}:00`;
}

function icon(name) {
  const path = ICONS[name] || ICONS.dot;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

function renderItem(article, rank, now) {
  const thumb = article.image
    ? `<img class="thumb" src="${escapeHtml(article.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  const meta = [article.sourceName, relativeTime(article.publishedAt, now)]
    .filter(Boolean)
    .join(' · ');

  return `<li class="item">
  <span class="rank">${rank}</span>
  <a class="body" href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">
    <span class="title">${escapeHtml(article.title)}</span>
    <span class="meta">${escapeHtml(meta)}</span>
  </a>
  ${thumb}
</li>`;
}

function renderCard(card, now) {
  const chips = card.keywords.length
    ? `<div class="chips">${card.keywords.map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('')}</div>`
    : '';
  const summary = card.summary
    ? `<p class="summary">${escapeHtml(card.summary)}</p>`
    : '';
  const body = card.items.length
    ? `<ol class="items">${card.items.map((a, i) => renderItem(a, i + 1, now)).join('\n')}</ol>`
    : `<p class="empty">아직 모인 기사가 없습니다. config/sources.json에 이 관심사의 소스를 추가해 보세요.</p>`;

  return `<section class="card">
  <header class="card-head">
    <span class="card-icon">${icon(card.icon)}</span>
    <h2>${escapeHtml(card.label)}</h2>
    <span class="pool">${card.poolSize}건 중</span>
  </header>
  ${chips}
  ${summary}
  ${body}
</section>`;
}

const STYLE = `
:root {
  --bg: #f7f7f5;
  --card: #ffffff;
  --line: rgba(0,0,0,.09);
  --ink: #1c1c1a;
  --ink-2: #5f5e5a;
  --ink-3: #8c8b85;
  --chip-bg: #eeedfe;
  --chip-ink: #3c3489;
  --panel: #f1efe8;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17171a;
    --card: #202024;
    --line: rgba(255,255,255,.11);
    --ink: #ececea;
    --ink-2: #a3a29c;
    --ink-3: #78776f;
    --chip-bg: #2b2856;
    --chip-ink: #cecbf6;
    --panel: #26262b;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px 20px 56px;
  background: var(--bg);
  color: var(--ink);
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1120px; margin: 0 auto; }
.top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  padding-bottom: 14px; margin-bottom: 20px;
  border-bottom: 1px solid var(--line);
}
.top h1 { font-size: 21px; font-weight: 600; margin: 0; letter-spacing: -.01em; }
.stamp { font-size: 13px; color: var(--ink-3); text-align: right; }
.stamp-row { display: inline-flex; align-items: center; gap: 6px; }
.reload {
  appearance: none; background: none; border: none;
  padding: 0; margin: 0; color: inherit; cursor: pointer;
  display: inline-flex; line-height: 0;
}
.reload svg { width: 15px; height: 15px; }
.reload:hover { color: var(--ink-2); }
.reload:focus-visible { outline: 2px solid var(--chip-ink); outline-offset: 2px; border-radius: 3px; }
.stamp-next { display: block; margin-top: 3px; font-size: 12px; color: var(--ink-3); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px 20px 8px;
}
.card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.card-head h2 { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: -.01em; }
.card-icon { display: flex; color: var(--ink-2); }
.card-icon svg { width: 19px; height: 19px; }
.pool { margin-left: auto; font-size: 12px; color: var(--ink-3); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chip { font-size: 12px; padding: 3px 9px; border-radius: 11px; background: var(--chip-bg); color: var(--chip-ink); }
.summary {
  margin: 0 0 12px; padding: 9px 11px;
  background: var(--panel); border-radius: 8px;
  font-size: 13px; line-height: 1.6; color: var(--ink-2);
}
.items { list-style: none; margin: 0; padding: 0; }
.item {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 10px 0; border-top: 1px solid var(--line);
}
.rank { font-size: 14px; font-weight: 600; color: var(--ink-3); min-width: 13px; padding-top: 1px; }
.body { flex: 1; min-width: 0; text-decoration: none; color: inherit; display: block; }
.title { display: block; font-size: 14.5px; line-height: 1.5; letter-spacing: -.005em; }
.body:hover .title { text-decoration: underline; text-underline-offset: 3px; }
.body:focus-visible { outline: 2px solid var(--chip-ink); outline-offset: 3px; border-radius: 3px; }
.meta { display: block; margin-top: 4px; font-size: 12px; color: var(--ink-3); }
.thumb {
  width: 62px; height: 52px; flex-shrink: 0;
  object-fit: cover; border-radius: 5px; background: var(--panel);
}
.empty { font-size: 13px; color: var(--ink-3); padding: 10px 0 16px; margin: 0; border-top: 1px solid var(--line); }
.foot { margin-top: 24px; font-size: 12px; color: var(--ink-3); line-height: 1.7; }
@media (max-width: 640px) {
  body { padding: 18px 14px 40px; }
  .card { padding: 14px 16px 6px; }
}
`;

export function renderHtml(config, cards, builtAt) {
  const stamp = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(builtAt);
  const nextRefresh = nextRefreshLabel(builtAt);
  const reloadTitle = '최신 페이지 다시 받기 (기사는 하루 3회 자동 갱신됩니다)';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(config.site.title)}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h1>${escapeHtml(config.site.title)}</h1>
    <div class="stamp">
      <div class="stamp-row">
        <span>${escapeHtml(stamp)} 기준 · 관련도순</span>
        <button type="button" class="reload" aria-label="${escapeHtml(reloadTitle)}" title="${escapeHtml(reloadTitle)}" onclick="location.href = location.pathname + '?t=' + Date.now()">${icon('refresh')}</button>
      </div>
      <span class="stamp-next">다음 갱신 ${escapeHtml(nextRefresh)}</span>
    </div>
  </div>
  <div class="grid">
${cards.map((card) => renderCard(card, builtAt)).join('\n')}
  </div>
  <p class="foot">제목을 누르면 해당 언론사 원문으로 이동합니다. 기사 선별은 관심사 설명을 기준으로 자동 정렬된 결과이며, 저작권은 각 언론사에 있습니다.</p>
</div>
</body>
</html>`;
}

export async function build(config, cards, outDir = 'docs') {
  const builtAt = new Date();
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/index.html`, renderHtml(config, cards, builtAt), 'utf8');
  await writeFile(
    `${outDir}/data.json`,
    JSON.stringify({ builtAt: builtAt.toISOString(), cards }, null, 2),
    'utf8'
  );
  await writeFile(`${outDir}/.nojekyll`, '', 'utf8');
  return builtAt;
}
