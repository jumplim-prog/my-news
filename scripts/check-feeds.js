import { readFile } from 'node:fs/promises';
import { fetchFeed } from '../lib/rss.js';
import { naverEnabled, searchNaver } from '../lib/naver.js';
import { claudeEnabled } from '../lib/claude.js';

const sourceConfig = JSON.parse(
  await readFile(new URL('../config/sources.json', import.meta.url), 'utf8')
);
const config = JSON.parse(
  await readFile(new URL('../config/interests.json', import.meta.url), 'utf8')
);

console.log(`RSS 피드 ${sourceConfig.sources.length}개 확인 중...\n`);

const alive = [];
const dead = [];

await Promise.all(sourceConfig.sources.map(async (source) => {
  try {
    const items = await fetchFeed(source);
    const withImage = items.filter((item) => item.image).length;
    alive.push({ source, count: items.length, withImage, sample: items[0]?.title || '' });
  } catch (error) {
    dead.push({ source, reason: error.message });
  }
}));

alive.sort((a, b) => a.source.id.localeCompare(b.source.id));
dead.sort((a, b) => a.source.id.localeCompare(b.source.id));

console.log(`살아있는 피드 ${alive.length}개`);
for (const { source, count, withImage, sample } of alive) {
  console.log(`  o ${source.name} [${source.interests.join(',')}] ${count}건, 썸네일 ${withImage}건`);
  if (sample) console.log(`      예: ${sample.slice(0, 50)}`);
}

if (dead.length) {
  console.log(`\n실패한 피드 ${dead.length}개 — sources.json에서 url을 고치거나 항목을 지우세요`);
  for (const { source, reason } of dead) {
    console.log(`  x ${source.name} (${source.id}): ${reason}`);
    console.log(`      ${source.url}`);
  }
}

const covered = new Set(alive.flatMap(({ source }) => source.interests));
const uncovered = config.interests.filter((interest) => !covered.has(interest.id));
if (uncovered.length) {
  console.log(`\n살아있는 소스가 하나도 없는 관심사: ${uncovered.map((i) => i.label).join(', ')}`);
}

if (naverEnabled()) {
  try {
    const items = await searchNaver('테스트', { display: 1 });
    console.log(`\n네이버 검색 API: 정상 (${items.length}건 응답)`);
  } catch (error) {
    console.log(`\n네이버 검색 API: 실패 — ${error.message}`);
  }
} else {
  console.log('\n네이버 검색 API: 키 없음 (선택 사항이지만 국내 소스 커버리지가 크게 늘어납니다)');
}

console.log(`Claude API 키: ${claudeEnabled() ? '있음' : '없음 (키워드 점수만 사용)'}`);
