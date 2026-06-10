# norebang-data

[노래방 번호검색 앱](https://github.com/kirin765/norebang-app)의 곡 카탈로그 데이터 저장소.

- `songs.db.gz` — TJ미디어 + 금영 곡번호 SQLite 카탈로그 (gzip)
- `version.json` — 카탈로그 버전(YYYY-MM-DD)·다운로드 URL. 앱이 주기적으로 확인한다.
- `scraper/` — 수집기 (canonical copy; 앱 repo의 사본은 로컬 개발용)
- `scraper/data/*.json` — 증분 수집을 위한 누적 원본 데이터

매달 3일 GitHub Actions(`monthly.yml`)가 TJ 전체 재수집 + 금영 신곡 증분 후 artifacts를 커밋한다.
Actions 러너 IP가 차단되어 실패하면 로컬에서 `scraper/README.md` 절차로 수동 실행 후 push.
