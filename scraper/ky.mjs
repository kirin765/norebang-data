// Crawls the KY (kysing.kr) catalog via title-search coverset queries.
// Coverset = greedy set cover over TJ titles' syllables (data/tj.json must exist),
// plus a-z and 0-9. Progress is checkpointed to data/ky-progress.json so the
// crawl can resume after interruption. Output: data/ky.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fetchRetry, sleep, normalize, parseKyPage } from './lib.mjs';

const DELAY_MS = 150; // kysing 서버 응답이 3~5초로 느려 페이지 동시 요청이 필요
const CONC = 5;
const PROGRESS = 'data/ky-progress.json';
const OUT = 'data/ky.json';

function buildCoverset() {
  const tj = JSON.parse(readFileSync('data/tj.json', 'utf8'));
  const titles = tj.map((s) => normalize(s.title)).filter(Boolean);
  const isHangul = (ch) => ch >= '가' && ch <= '힣';

  // count syllable -> set of title indexes containing it
  const bySyll = new Map();
  titles.forEach((t, i) => {
    for (const ch of new Set(t)) {
      if (!isHangul(ch)) continue;
      if (!bySyll.has(ch)) bySyll.set(ch, new Set());
      bySyll.get(ch).add(i);
    }
  });

  // greedy set cover over titles that contain at least one hangul syllable
  const uncovered = new Set(titles.map((_, i) => i).filter((i) => [...titles[i]].some(isHangul)));
  const chosen = [];
  while (uncovered.size > 0) {
    let best = null, bestGain = 0;
    for (const [ch, set] of bySyll) {
      let gain = 0;
      for (const i of set) if (uncovered.has(i)) gain++;
      if (gain > bestGain) { bestGain = gain; best = ch; }
    }
    if (!best || bestGain === 0) break;
    chosen.push(best);
    for (const i of bySyll.get(best)) uncovered.delete(i);
    bySyll.delete(best);
  }
  const latin = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  return [...chosen, ...latin];
}

async function searchPage(keyword, page) {
  const url = `https://kysing.kr/search/?category=2&keyword=${encodeURIComponent(keyword)}&s_page=${page}`;
  const res = await fetchRetry(url);
  return parseKyPage(await res.text());
}

// --- main ---
mkdirSync('data', { recursive: true });
const progress = existsSync(PROGRESS)
  ? JSON.parse(readFileSync(PROGRESS, 'utf8'))
  : { doneQueries: [], songs: {} };
const done = new Set(progress.doneQueries);
const songs = progress.songs; // no -> {no,title,artist}

const coverset = buildCoverset();
console.log(`coverset: ${coverset.length} queries, ${done.size} already done, ${Object.keys(songs).length} songs so far`);

let consecutiveEmpty = 0;
for (const q of coverset) {
  if (done.has(q)) continue;
  let added = 0;
  const collect = (rows) => {
    for (const s of rows) {
      if (!songs[s.no]) { songs[s.no] = s; added++; }
    }
  };
  let first;
  try {
    first = await searchPage(q, 1);
  } catch (e) {
    console.log(`FAIL ${q} p1: ${e.message} — checkpointing and aborting`);
    save();
    process.exit(1);
  }
  collect(first.rows);
  consecutiveEmpty = first.rows.length === 0 ? consecutiveEmpty + 1 : 0;
  let maxPage = first.maxPage;
  let page = 2;
  while (page <= maxPage) {
    const batch = [];
    for (let i = 0; i < CONC && page <= maxPage; i++, page++) batch.push(searchPage(q, page));
    let results;
    try {
      results = await Promise.all(batch);
    } catch (e) {
      console.log(`FAIL ${q} ~p${page}: ${e.message} — checkpointing and aborting`);
      save();
      process.exit(1);
    }
    for (const r of results) {
      collect(r.rows);
      maxPage = Math.max(maxPage, r.maxPage);
    }
    await sleep(DELAY_MS);
  }
  done.add(q);
  save();
  console.log(`[${done.size}/${coverset.length}] "${q}" pages=${maxPage} new=${added} total=${Object.keys(songs).length}`);
  if (consecutiveEmpty >= 10) {
    console.log('10 consecutive empty queries — possible block, aborting');
    save();
    process.exit(1);
  }
}
save();
writeFileSync(OUT, JSON.stringify(Object.values(songs)));
console.log(`KY: ${Object.keys(songs).length} songs -> ${OUT}`);

function save() {
  progress.doneQueries = [...done];
  writeFileSync(PROGRESS, JSON.stringify(progress));
}
