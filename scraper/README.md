# norebang scraper

TJ미디어·금영 곡번호 카탈로그 수집기. Node 18+ / sqlite3 CLI만 필요 (npm 의존성 없음).

## 부트스트랩 (1회)

```bash
cd scraper
node tj.mjs            # TJ 전체 카탈로그 (요청 1회) -> data/tj.json
node ky.mjs            # KY 커버셋 크롤 (수 시간, 중단 시 재실행하면 이어서) -> data/ky.json
node build-db.mjs      # -> dist/songs.db, dist/songs.db.gz, dist/version.json
```

## 월간 갱신

```bash
cd scraper
node tj.mjs            # TJ는 매번 전체 재수집 (1요청)
node ky-latest.mjs     # KY는 이달의 신곡만 증분
node build-db.mjs
```

산출물 배포: `dist/songs.db.gz` + `dist/version.json`을 공개 repo `kirin765/norebang-data`(main)에 push.
앱은 `version.json`의 `version`(YYYY-MM-DD)이 로컬보다 새로우면 `db_url`에서 내려받아 교체한다.

앱 번들 갱신: `dist/songs.db`를 `app/src/main/assets/songs.db`로 복사하면 신규 설치도 최신 시작.
