import { readFile } from 'node:fs/promises';
import { collect } from './collect.js';
import { score } from './score.js';
import { build } from './build.js';
import { claudeEnabled } from '../lib/claude.js';
import { naverEnabled } from '../lib/naver.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function main() {
  const started = Date.now();
  const config = await loadJson('../config/interests.json');
  const sourceConfig = await loadJson('../config/sources.json');

  console.log(`관심사 ${config.interests.length}개, 소스 ${sourceConfig.sources.length}개`);
  console.log(`Claude 점수 매기기: ${claudeEnabled() ? '켜짐' : '꺼짐 (키워드 점수만 사용)'}`);
  console.log(`네이버 검색 수집: ${naverEnabled() ? '켜짐' : '꺼짐'}\n`);

  console.log('[1/3] 수집');
  const { articles, report } = await collect(config, sourceConfig);
  for (const line of report.ok) console.log(`  ${line}`);
  for (const line of report.failed) console.log(`  x ${line}`);
  console.log(`  중복 제거 후 ${articles.length}건\n`);

  if (articles.length === 0) {
    console.error('수집된 기사가 없습니다. npm run check 로 피드 상태를 확인하세요.');
    process.exitCode = 1;
    return;
  }

  console.log('[2/3] 점수 매기기');
  const cards = await score(config, articles);

  console.log('\n[3/3] 페이지 생성');
  const builtAt = await build(config, cards);
  console.log(`  docs/index.html 작성 완료 (${builtAt.toISOString()})`);
  console.log(`\n완료 · ${((Date.now() - started) / 1000).toFixed(1)}초`);
}

main().catch((error) => {
  console.error('\n실패:', error.message);
  process.exit(1);
});
