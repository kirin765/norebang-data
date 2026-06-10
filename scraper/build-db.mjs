// Builds songs.db (SQLite) + songs.db.gz + version.json from data/tj.json + data/ky.json.
// Uses the sqlite3 CLI via a SQL dump to avoid npm dependencies.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { normalize } from './lib.mjs';

const tj = JSON.parse(readFileSync('data/tj.json', 'utf8'));
const ky = JSON.parse(readFileSync('data/ky.json', 'utf8'));
const version = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/'/g, "''");
const lines = [
  'PRAGMA journal_mode=OFF;',
  'PRAGMA synchronous=OFF;',
  'BEGIN;',
  'CREATE TABLE songs(brand TEXT NOT NULL, number INTEGER NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL, norm_title TEXT NOT NULL, norm_artist TEXT NOT NULL);',
  'CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);',
  `INSERT INTO meta VALUES('version','${version}');`,
];
const add = (brand, s) => {
  const title = s.title?.trim(), artist = (s.artist || '').trim();
  if (!title || !(s.no > 0)) return 0;
  lines.push(`INSERT INTO songs VALUES('${brand}',${s.no},'${esc(title)}','${esc(artist)}','${esc(normalize(title))}','${esc(normalize(artist))}');`);
  return 1;
};
let nTj = 0, nKy = 0;
for (const s of tj) nTj += add('TJ', s);
for (const s of ky) nKy += add('KY', s);
lines.push(
  'CREATE INDEX idx_nt ON songs(norm_title);',
  'CREATE INDEX idx_na ON songs(norm_artist);',
  'COMMIT;',
  'VACUUM;'
);

mkdirSync('dist', { recursive: true });
execFileSync('rm', ['-f', 'dist/songs.db']);
writeFileSync('dist/build.sql', lines.join('\n'));
execFileSync('sqlite3', ['dist/songs.db'], { input: readFileSync('dist/build.sql') });
const db = readFileSync('dist/songs.db');
writeFileSync('dist/songs.db.gz', gzipSync(db, { level: 9 }));
writeFileSync('dist/version.json', JSON.stringify({
  version,
  db_url: 'https://raw.githubusercontent.com/kirin765/norebang-data/main/songs.db.gz',
  songs: nTj + nKy,
  tj: nTj,
  ky: nKy,
}));
console.log(`db: TJ=${nTj} KY=${nKy} total=${nTj + nKy}`);
console.log(`sizes: db=${statSync('dist/songs.db').size} gz=${statSync('dist/songs.db.gz').size}`);
