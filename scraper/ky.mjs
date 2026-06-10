// Crawls the KY (kysing.kr) catalog via title-search coverset queries.
// Coverset = greedy set cover over TJ titles' syllables (data/tj.json must exist),
// plus a-z and 0-9. Progress is checkpointed to data/ky-progress.json so the
// crawl can resume after interruption. Output: data/ky.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fetchRetry, sleep, normalize } from './lib.mjs';

const DELAY_MS = 700;
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

function parsePage(html) {
  // each result row is a ul.search_chart_list; first one is the header
  const rows = [];
  const blocks = html.split('search_chart_list').slice(2); // skip pre-header + header
  for (const b of blocks) {
    const num = b.match(/search_chart_num[^>]*>\s*([0-9]+)\s*</)?.[1];
    const tit = b.match(/search_chart_tit[^>]*>[\s\S]*?<span class="tit"[^>]*>([\s\S]*?)<\/span>/)?.[1];
    const sng = b.match(/search_chart_sng[^"]*"\s*title="([^"]*)"/)?.[1];
    if (num && tit) {
      rows.push({
        no: Number(num),
        title: decodeEntities(tit.replace(/<[^>]+>/g, '').trim()),
        artist: decodeEntities((sng || '').trim()),
      });
    }
  }
  const pages = [...html.matchAll(/s_page=(\d+)/g)].map((m) => Number(m[1]));
  return { rows, maxPage: pages.length ? Math.max(...pages) : 1 };
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

async function searchPage(keyword, page) {
  const url = `https://kysing.kr/search/?category=2&keyword=${encodeURIComponent(keyword)}&s_page=${page}`;
  const res = await fetchRetry(url);
  return parsePage(await res.text());
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
  let page = 1, maxPage = 1, added = 0;
  while (page <= maxPage) {
    let parsed;
    try {
      parsed = await searchPage(q, page);
    } catch (e) {
      console.log(`FAIL ${q} p${page}: ${e.message} — checkpointing and aborting`);
      save();
      process.exit(1);
    }
    maxPage = Math.max(maxPage, parsed.maxPage);
    if (parsed.rows.length === 0 && page === 1) consecutiveEmpty++;
    else consecutiveEmpty = 0;
    for (const s of parsed.rows) {
      if (!songs[s.no]) { songs[s.no] = s; added++; }
    }
    page++;
    await sleep(DELAY_MS);
  }
  done.add(q);
  progress.doneQueries = [...done];
  if (done.size % 5 === 0) save();
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
