import { withTimeout } from './util.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

export function claudeEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function callClaude(prompt, { maxTokens = 2000, timeoutMs = 60000 } = {}) {
  const response = await withTimeout(
    (signal) => fetch(ENDPOINT, {
      signal,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    }),
    timeoutMs,
    'Claude API'
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

function extractJson(text) {
  const fenced = text.replace(/```(?:json)?/gi, '').trim();
  const start = fenced.search(/[[{]/);
  if (start === -1) throw new Error('JSON을 찾지 못함');
  const opener = fenced[start];
  const closer = opener === '[' ? ']' : '}';
  const end = fenced.lastIndexOf(closer);
  if (end <= start) throw new Error('JSON이 잘림');
  return JSON.parse(fenced.slice(start, end + 1));
}

export async function scoreArticles(interest, articles) {
  const list = articles
    .map((article, index) => `${index}. ${article.title}${article.summary ? ` — ${article.summary.slice(0, 90)}` : ''}`)
    .join('\n');

  const prompt = `당신은 한 독자의 개인 뉴스 큐레이터입니다.

이 독자의 "${interest.label}" 관심사는 다음과 같습니다.
${interest.description}

아래 기사 목록에서 각 기사가 이 관심사에 얼마나 부합하는지 0~10점으로 평가하세요.
- 9~10점: 이 독자가 반드시 읽고 싶어할 기사
- 6~8점: 관련 있고 읽을 만한 기사
- 3~5점: 주변부, 약하게 관련
- 0~2점: 무관하거나 독자가 명시적으로 제외한 유형

기사 목록:
${list}

응답은 JSON 배열만 출력하세요. 설명, 머리말, 코드펜스 없이 순수 JSON만.
형식: [{"i": 기사번호, "s": 점수}]
목록에 있는 모든 기사를 빠짐없이 포함하세요.`;

  const raw = await callClaude(prompt, { maxTokens: 4000 });
  const parsed = extractJson(raw);

  const scores = new Map();
  for (const entry of parsed) {
    const index = Number(entry.i ?? entry.index);
    const score = Number(entry.s ?? entry.score);
    if (Number.isInteger(index) && Number.isFinite(score)) {
      scores.set(index, Math.max(0, Math.min(10, score)));
    }
  }
  return scores;
}

export async function summarizeCard(interest, articles) {
  const list = articles.map((article, index) => `${index + 1}. ${article.title}`).join('\n');

  const prompt = `아래는 "${interest.label}" 주제로 오늘 모인 기사 제목들입니다.

${list}

이 제목들에서 읽어낼 수 있는 오늘의 흐름을 한 문장으로 요약하세요.
- 60자 이내, 한국어
- 기사 제목을 그대로 옮기지 말고 종합해서 쓸 것
- 큰 흐름이 안 보이면 가장 눈에 띄는 두 가지를 병렬로 제시
- 따옴표나 머리말 없이 문장만 출력`;

  const raw = await callClaude(prompt, { maxTokens: 200 });
  return raw.trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 120);
}
