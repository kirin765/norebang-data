// Fetches the full TJ catalog via the newSongOfMonth API (returns everything
// published since searchYm in one response) and writes data/tj.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fetchRetry } from './lib.mjs';

const SINCE = process.argv[2] || '190001';

const res = await fetchRetry('https://www.tjmedia.com/legacy/api/newSongOfMonth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `searchYm=${SINCE}`,
});
const json = await res.json();
const items = json?.resultData?.items || [];
if (items.length < 1000) throw new Error(`suspiciously few TJ songs: ${items.length}`);

const songs = items.map((it) => ({
  no: Number(it.pro),
  title: String(it.indexTitle ?? '').trim(),
  artist: String(it.indexSong ?? '').trim(),
})).filter((s) => s.no > 0 && s.title);

mkdirSync('data', { recursive: true });
writeFileSync('data/tj.json', JSON.stringify(songs));
console.log(`TJ: ${songs.length} songs -> data/tj.json`);
