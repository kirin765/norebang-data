// Monthly incremental for KY: parses kysing.kr/latest/ (this month's new songs)
// and merges them into data/ky.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchRetry, sleep, parseKyPage } from './lib.mjs';

const ky = JSON.parse(readFileSync('data/ky.json', 'utf8'));
const byNo = new Map(ky.map((s) => [s.no, s]));

let page = 1, maxPage = 1, added = 0;
while (page <= maxPage) {
  const res = await fetchRetry(`https://kysing.kr/latest/?s_page=${page}`);
  const parsed = parseKyPage(await res.text());
  maxPage = Math.max(maxPage, parsed.maxPage);
  for (const s of parsed.rows) {
    if (!byNo.has(s.no)) { byNo.set(s.no, s); added++; }
  }
  page++;
  await sleep(700);
}
writeFileSync('data/ky.json', JSON.stringify([...byNo.values()]));
console.log(`KY latest: +${added} new, total ${byNo.size}`);
