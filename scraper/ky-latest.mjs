// Monthly incremental for KY: parses kysing.kr/latest/ (this month's new songs)
// and merges them into data/ky.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchRetry, sleep } from './lib.mjs';

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function parsePage(html) {
  const rows = [];
  const blocks = html.split('search_chart_list').slice(2);
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

const ky = JSON.parse(readFileSync('data/ky.json', 'utf8'));
const byNo = new Map(ky.map((s) => [s.no, s]));

let page = 1, maxPage = 1, added = 0;
while (page <= maxPage) {
  const res = await fetchRetry(`https://kysing.kr/latest/?s_page=${page}`);
  const parsed = parsePage(await res.text());
  maxPage = Math.max(maxPage, parsed.maxPage);
  for (const s of parsed.rows) {
    if (!byNo.has(s.no)) { byNo.set(s.no, s); added++; }
  }
  page++;
  await sleep(700);
}
writeFileSync('data/ky.json', JSON.stringify([...byNo.values()]));
console.log(`KY latest: +${added} new, total ${byNo.size}`);
