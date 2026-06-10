export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STRIP = /[\s\p{P}·…〜~]+/gu;
export const normalize = (s) => (s || '').toLowerCase().replace(STRIP, '');

export function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

// Parses a kysing.kr search/latest result page.
// Row shape (see search_chart_list ul):
//   <li class="search_chart_num">49492</li>
//   <li class="search_chart_tit clear"><span title="밤 편지" class="tit">...
//   <li class="search_chart_sng" title="아이유(IU)">...
export function parseKyPage(html) {
  const rows = [];
  const blocks = html.split('search_chart_list').slice(2); // skip pre-header + header row
  for (const b of blocks) {
    const num = b.match(/search_chart_num[^>]*>\s*(\d+)/)?.[1];
    const tit = b.match(/<span\s+title="([^"]*)"\s+class="tit"/)?.[1]
      ?? b.match(/<span[^>]*class="tit"[^>]*\stitle="([^"]*)"/)?.[1];
    const sng = b.match(/search_chart_sng[^>]*\stitle="([^"]*)"/)?.[1];
    if (num && tit) {
      rows.push({
        no: Number(num),
        title: decodeEntities(tit.trim()),
        artist: decodeEntities((sng || '').trim()),
      });
    }
  }
  const pages = [...html.matchAll(/s_page=(\d+)/g)].map((m) => Number(m[1]));
  return { rows, maxPage: pages.length ? Math.max(...pages) : 1 };
}

export async function fetchRetry(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, ...opts });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}
