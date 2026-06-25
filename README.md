# Gamma-Ticketing (mobileticket)

밴드 공연 예매 + 현장 체크인(오프라인 대응) + 관리자 데이터 관리(CSV)용 프로젝트입니다.

## 구성

- `server/`: Node.js(Express) + MongoDB(Mongoose) API 서버
- `client/`: React + Tailwind( Vite ) 프론트

## 환경변수

`server/.env`를 만들고 아래를 채워주세요(예시는 `server/.env.example` 참고).

- `MONGO_URI`: MongoDB 연결 문자열
- `STAFF_SECRET`: 스태프 화면(/staff) 및 스태프 API 보호용 passcode
- `CORS_ORIGIN`: 개발용(예: `http://localhost:5173`)
- `PORT`: 기본 3001

## 실행

```bash
npm install
npm run dev
```

- 관객 예매 화면: `http://localhost:5173/reserve`
- 예매번호 조회 화면: `http://localhost:5173/reserve/lookup`
- 스태프 체크인 화면: `http://localhost:5173/staff`
- API 서버: `http://localhost:3001`

## 주요 API

- `POST /api/tickets`: 예매 생성(관객)
- `GET /api/tickets`: 전체 조회(스태프, 헤더 `x-staff-secret` 필요)
- `PATCH /api/tickets/:id/checkin`: 입장 토글(스태프)
- `PATCH /api/tickets/:id/payment`: 입금 토글(스태프)
- `GET /api/tickets/export.csv`: CSV 내보내기(스태프)
