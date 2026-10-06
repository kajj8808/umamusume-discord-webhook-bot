# 우마무스메 사료 계산 웹훅 — 최신 시트 연동

기존 Hono/TypeScript 봇의 CSV·고정 보상 계산을 공개 Google Sheets 기반으로 교체했습니다. 기존 2024년 12월 6일 버전은 `archive/2024-12-06` 브랜치에서 확인할 수 있습니다.

## 검증된 범위

- 계산기·가챠 원본 2개 다운로드 및 재조회
- 개인 조건에 따른 데일리팩, 무료/프리미엄 트레이닝 패스, 성적별 보상 재계산
- 향후 3개월의 픽업별 예상 쥬얼·티켓·조각 알림 생성
- Hono 서버 실행 및 API 응답
- 한국 시간 00:05 스케줄 등록 코드
- 원본 시트 결과 대조, 연도 변경·월말 날짜, 디스코드 메시지 분할·전송 오류 검증

계산 결과와 카카오 공지의 실제 Discord 테스트 전송을 확인했습니다. 운영 서버에는 아직 배포하지 않았으며, 정기 전송은 프로세스가 실행 중일 때만 동작합니다.

## 실행

Node.js 22 이상에서 저장소 폴더를 열고:

```text
npm install
npm run sync
npm run typecheck
npm test
npm run preview
```

`preview`는 최신 원본을 읽고 알림 내용을 출력하지만 보내지 않습니다. 결과는 `runtime-data/preview.json`에 저장합니다. 이미 읽은 데이터로 확인하려면 `npm run preview -- --offline`을 사용합니다.

## 계산 조건

`config.example.json`을 `config.json`으로 복사하고 설정합니다. 파일이 없으면 예제 기본값을 사용합니다.

기본값: 서클 S / 팀레 CLASS 5 / 챔미 그레이드 A결 3위 / 말오스 플레티넘 3 / 트레이닝 패스 프리미엄 구매 / 월초 말뽑·서폿 티켓 각각 9장. 데일리팩과 그 외 유료 상품은 미구매입니다. 트레이닝 패스 미구매로 바꾸면 원본의 일반 무료 보상만 포함합니다.

- `daily`: 데일리팩 반복 구매 여부
- `dailyDate`: 데일리팩 포함 시 실제 최초 구매일. 원본처럼 30일마다 갱신 구매를 가정
- `pass`: 프리미엄 트레이닝 패스 구매 여부
- `selector`, `pack`: 원본 일정에 기록된 선택권/쥬얼 패키지를 모두 구매하는 가정
- `monthlyHorse`, `monthlySupport`: 월초 구매 티켓 수
- `medal`: 월초 메달상점 조각 구매 여부

알림에는 적용한 조건을 함께 표시합니다. 기준일 다음 날부터 각 픽업 시작일까지의 누적 예상 수입이며 현재 보유량이나 가챠 지출은 포함하지 않습니다. 원본 이벤트 보상 전부 획득을 가정하며, 앞으로의 일정·참여·구매 여부에 따라 실제 획득량은 달라집니다.

## 디스코드 전송

기존 환경변수 이름 `WEBHOOK_URL`을 그대로 사용합니다. 실제 값을 실행 환경의 비밀 변수로 설정하세요. `.env`를 쓸 경우 Node의 로더를 명시합니다.

```text
node --env-file=.env --import tsx scripts/daily.ts --dry-run
node --env-file=.env --import tsx scripts/daily.ts
node --env-file=.env --import tsx src/index.ts
```

환경변수가 이미 설정된 서버에서는 `npm run send:once`로 즉시 전송, `npm start`로 서버와 매일 00:05 `Asia/Seoul` 스케줄을 실행합니다. 즉시 전송한 날은 정기 작업에서 다시 보내지 않습니다.

봇 프로세스가 계속 실행되고 `runtime-data`가 유지되어야 합니다. 프로세스 종료·서버 재부팅 중의 예약 실행은 자동 보충되지 않습니다. 배포 시 서비스 관리자에서 자동 재시작을 설정하세요. API는 기본적으로 `127.0.0.1:3000`에만 바인딩하며 컨테이너에서는 필요에 따라 `HOST=0.0.0.0`을 사용합니다.

10개 픽업마다 메시지를 분할합니다. 디스코드의 메시지 ID를 확인한 뒤 전송 진행을 저장합니다. 부분 실패 시 같은 날 다음 실행은 미전송 메시지부터 재시도합니다. 전송 성공 후 응답이 유실되면 중복될 수 있습니다. 실행 실패는 로그로 확인하고 `send:once`로 재시도하세요. 프로세스 강제 종료 후 `daily.lock`이 남으면 실행 중인 작업이 없는지 확인한 뒤 해당 잠금 파일만 제거합니다.

## API

- `/health`: 모드와 스케줄 정보
- `/get/main-pickup`: 최신 픽업 목록
- `/get/forecast`: 현재 조건의 3개월 예상 획득량
- `/get/rewords`: 기존 URL 유지. 이제 `format: workbook-cells`의 원본 셀 데이터 반환

기존 Prisma/CSV 응답 필드와 새 API 구조는 다릅니다. 기존 API를 사용하는 외부 프로그램이 있다면 새 구조에 맞춰야 합니다. 미래 웹사이트는 `/get/forecast`와 공통 계산 엔진을 사용할 수 있습니다.

## 원본과 이전 코드

- 원본 계산기: https://docs.google.com/spreadsheets/d/1ryM_NsaMuWCxNWfLr5Y4sb6faL1iXbAasCIAOEbAbEI/edit
- 가챠 데이터: https://docs.google.com/spreadsheets/d/14Y1k52ueyCWsA0wuJXOQLsaieDuICOtrvHHrs4Mqo1Q/edit
- 예전 진입점·설명·Bun 잠금 파일은 `legacy/`, 예전 CSV·Prisma·카카오 수집 소스는 기존 폴더에 보존했습니다. 사료 계산에는 Prisma 초기화나 브라우저가 필요하지 않으며 카카오 알림을 켜면 Chrome/Chromium이 필요합니다.
- SheetJS는 오래된 npm registry 버전 대신 공식 배포본 0.20.3을 사용합니다: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/

실행 예시를 생성한 `알림_미리보기.md`는 보관된 데이터의 예시이며 실제 채널에 전송한 메시지가 아닙니다.

## 카카오 채널 공지 알림

공식 카페 본문 수집 없이 카카오 채널 목록의 제목·요약·이미지·개별 글 링크를 읽습니다. 글 ID로 중복 확인하며 이미지가 없어도 수집합니다. 수집 0개는 정상적인 '새 글 없음'이 아닌 오류로 처리합니다.

```text
npm run preview:notices
npm run init:notices
npm run send:notices
```

첫 명령은 전송 없는 수집 확인입니다. 두 번째는 기존 글을 기준으로 저장해 과거 공지의 일괄 발송을 방지합니다. 세 번째는 새로운 글만 전송하며 `WEBHOOK_URL`이 필요합니다. 초기화하지 않고 첫 실행해도 기존 글을 기준으로만 저장합니다. 이미 기준이 있는 상태에서는 `init:notices`가 기준을 덮어쓰지 않습니다.

상시 서버에서 `KAKAO_NOTICES=true`를 설정하면 매시 00분·30분에 수집합니다. 사료 계산과 별도 작업이라 공지 수집 실패가 사료 알림을 막지 않습니다. 기본값은 꺼짐입니다. 아직 실제 채널 전송은 검증하지 않았습니다.

실행 환경에 Chrome/Chromium이 필요합니다. Windows의 일반 Chrome/Edge 설치 경로와 Linux의 일반 Chromium 경로를 자동 확인하며, 다른 설치 경로는 `CHROME_EXECUTABLE`에 지정하세요. 패키지가 브라우저를 자동으로 다운로드하지는 않습니다.

최신 목록을 기준으로 최대 세 번 수집합니다. 현재 실제 페이지에서는 20개 공지를 확인했습니다. 전체 505개 과거 공지 수집이나 장기간 중단된 동안의 모든 누락 공지 복구를 보장하지 않습니다. 상세 공식 카페 본문은 수집하지 않습니다.

전송할 새 글을 먼저 큐에 저장하고 전송 확인 후 제거합니다. 실패하면 다음 실행에 재시도합니다. 상태는 `runtime-data/notices.json`, 최근 수집 결과는 `notices-status.json`, 임베드 미리보기는 `notices-preview.json`입니다. 프로세스 강제 종료 후 `notices.lock`이 남으면 실행 중인 수집이 없는지 확인한 뒤 해당 파일만 제거하세요.
