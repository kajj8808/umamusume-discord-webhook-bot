# Umamusume webhook bot

우마무스메 한국 서비스에 관련된 정보를 얻을 수 있는 봇입니다.

### 설치

> Hono 4.6 버전으로 만들어진 프로젝트입니다.

```
npm install
npx prisma migrate dev --name init
npx prisma db push
npx prisma generate
```

### 기능

- 1. 사료 계산기 ( 3개월 만큼 사료{무료 재화}를 계산해주는 webhook봇입니다. 0시 5분에 실행됩니다.)

### REST

- /get/main-pickup (main pickup csv 파일 데이터)
- /get/rewords (reword -> data.csv 파일 데이터)

### ENV

- DATABASE_URL (ex. "file:./database.db")
- WEBHOOK_URL (discord webhook url)
- PORT (server port)

### 참조

- [Puppeteer](https://pptr.dev/)

- [Puppeteer 사용법](https://velog.io/@jeffyoun/Puppeteer%EB%A1%9C-%ED%95%99%EA%B5%90-%EA%B3%B5%EC%A7%80-%EA%B8%80-%ED%81%AC%EB%A1%A4%EB%A7%81-%ED%95%98%EA%B8%B0)
