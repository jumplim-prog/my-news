# 내 뉴스

관심사별로 카드가 나뉘고, 각 카드 안에서 나와의 관련도 순으로 기사가 정렬되는 개인 뉴스 페이지. 제목을 누르면 해당 언론사 원문으로 바로 이동한다.

의존성 없이 Node 내장 기능만 쓴다. `npm install` 필요 없음.

---

## 5분 만에 돌려보기

```bash
cd my-news
npm run check     # 피드 24개가 살아있는지 확인
npm start         # 수집 → 점수 → 페이지 생성
npm run serve     # http://localhost:4321 에서 열기
```

API 키가 하나도 없어도 돌아간다. 이 경우 키워드 매칭으로 정렬한다. 키를 넣으면 훨씬 똑똑해진다.

## 키 넣기 (선택)

```bash
cp .env.example .env
```

`.env`를 열어 채운다.

| 키 | 없으면 | 있으면 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 키워드 점수로 정렬 | 관심사 설명을 읽고 0~10점으로 정렬, 카드 요약 생성 |
| `NAVER_CLIENT_ID` / `SECRET` | RSS 피드만 수집 | RSS 없는 국내 매체까지 검색으로 수집 |

네이버 키는 [developers.naver.com/apps](https://developers.naver.com/apps)에서 앱 등록 후 '검색' API를 추가하면 나온다. 무료다.

Claude API 비용은 하루 3회 실행 기준 월 1~2달러 수준이다. 관심사 하나당 기사 40건의 제목만 넘기므로 토큰을 많이 쓰지 않는다.

---

## 인터넷에 올리기

GitHub Pages + Actions 조합이 가장 간단하다. 서버가 필요 없고 무료다.

1. 이 폴더를 GitHub 저장소로 올린다.
2. 저장소 Settings → Pages → Source를 `Deploy from a branch`, 브랜치는 `main`, 폴더는 `/docs`로 지정한다.
3. Settings → Secrets and variables → Actions에서 `ANTHROPIC_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 등록한다.
4. Actions 탭에서 `update news` 워크플로를 한 번 수동 실행(`Run workflow`)해 본다.

이후 한국 시간 기준 새벽 6시, 정오, 오후 6시에 자동으로 갱신된다. 주소는 `https://아이디.github.io/저장소이름/`이 된다.

시간을 바꾸려면 `.github/workflows/update.yml`의 cron을 고친다. 값은 UTC 기준이라 한국 시간에서 9를 빼면 된다.

---

## 고치는 법

### 관심사 추가하기

`config/interests.json`의 `interests` 배열에 항목을 하나 더 넣는다.

```json
{
  "id": "music",
  "label": "음악",
  "icon": "dot",
  "description": "여기에 뭘 읽고 싶고 뭘 읽기 싫은지 문장으로 쓴다. 이 문장을 Claude가 읽고 점수를 매기므로, 구체적일수록 결과가 좋아진다. 제외하고 싶은 유형도 명시할 것.",
  "keywords": ["작곡", "연주", "음반"],
  "naverQueries": ["클래식 음반", "음악 공연"],
  "showSummary": false
}
```

그리고 `config/sources.json`에서 이 관심사에 기사를 공급할 소스의 `interests` 배열에 `"music"`을 추가한다. 소스가 하나도 없으면 카드가 비어 보인다. 네이버 키가 있다면 `naverQueries`만으로도 채워진다.

`description`이 가장 중요하다. 키워드 나열이 아니라 사람에게 설명하듯 쓰는 편이 정확도가 높다. 결과가 마음에 안 들면 대부분 이 문장을 고쳐서 해결된다.

`icon`은 `chart`, `flower`, `book`, `palette`, `dot` 중 하나다. 새 아이콘은 `scripts/build.js`의 `ICONS`에 SVG path를 추가하면 된다.

### 소스 추가하기

`config/sources.json`에 넣고 `npm run check`로 살아있는지 본다. 대부분의 국내 인터넷 신문은 `주소/rss/allArticle.xml` 형태를 쓴다.

### 화면 조절하기

`config/interests.json`의 `site` 항목:

- `itemsPerCard` — 카드당 기사 수 (기본 5)
- `maxAgeHours` — 이보다 오래된 기사는 버림 (기본 72)
- `minScore` — 이 점수 미만이면 자리가 남아도 싣지 않음 (기본 3). 카드가 자꾸 비면 낮추고, 엉뚱한 기사가 섞이면 올린다.
- `summaryEnabled` — 카드 요약 전체 스위치. 개별 카드는 각 관심사의 `showSummary`로 켠다.

색과 여백은 `scripts/build.js` 안의 `STYLE` 문자열에 있다. 다크모드는 자동으로 따라간다.

---

## 알아둘 것

**썸네일이 없는 기사가 있다.** 일부 언론사는 외부에서 이미지 불러가는 것을 막는다. 이 경우 이미지가 조용히 사라지고 제목만 남는다. 정상 동작이다.

**피드는 죽는다.** 언론사가 주소를 바꾸거나 RSS를 없애기도 한다. 수집 단계에서 실패한 소스는 건너뛰고 나머지로 진행하므로 사이트가 깨지지는 않는다. 가끔 `npm run check`를 돌려 정리하면 된다.

**저작권.** 제목, 출처, 시각, 링크만 보여주고 본문은 원문으로 보낸다. 요약도 여러 제목을 종합한 한 문장이지 기사 본문의 재현이 아니다. 개인용으로 쓰는 한 문제될 것이 없다. 공개해서 여러 사람이 보게 할 생각이라면 각 언론사 이용약관을 한 번 확인하는 편이 좋다.

**첫 실행은 결과가 밋밋할 수 있다.** 관심사 설명이 아직 거칠기 때문이다. 며칠 써보면서 "이건 왜 올라왔지" 싶은 기사가 보일 때마다 `description`에 제외 조건을 한 줄씩 추가하면 빠르게 좋아진다.

---

## 파일 구조

```
config/interests.json    관심사 정의 — 가장 자주 고칠 파일
config/sources.json      RSS 소스 목록
lib/rss.js               RSS 2.0 / Atom 파서
lib/naver.js             네이버 검색 API
lib/claude.js            점수 매기기와 요약
lib/util.js              날짜, 문자열, 중복 처리
scripts/collect.js       수집과 중복 제거
scripts/score.js         점수 계산과 카드 구성
scripts/build.js         HTML 생성 (디자인이 여기 있음)
scripts/run.js           전체 실행
scripts/check-feeds.js   피드 상태 점검
docs/                    생성 결과물 (GitHub Pages가 여기를 본다)
```
