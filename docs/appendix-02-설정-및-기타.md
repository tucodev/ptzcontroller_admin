# 설정

## 환경변수

1. ptzcontroller_admin (이하 admin)

.env 에 다음과 같은 환경변수가 있어야한다. 물론 디폴트 값이 하드코딩되어 있긴하다.

| 변수               | 필수 |                                                                                                                   | 설명                                            | 예시 |
| ------------------ | ---- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---- |
| DATABASE_URL       | ✅   | PostgreSQL 연결 문자열 (Prisma)                                                                                   | postgresql://user:pw@host/db?sslmode=require    |
| PROXY_TOKEN_SECRET | ⬜   | PTZ Proxy 토큰 인증 서명 키 — 미설정 시 NEXTAUTH_SECRET 사용                                                      | ptz-proxy-token-secret                          |
| NEXTAUTH_SECRET    | ✅   | JWT 서명 키 (32자 이상 랜덤 문자열)                                                                               | wdaa3EIyANLmrkF4ENZ6WRs8HDD0zQUJ                |
| NEXTAUTH_URL       | ✅   | 앱 접속 URL (NextAuth 콜백용)                                                                                     | http://localhost:3000 / https://your-domain.com |
| LICENSE_SECRET     | ✅   | 라이선스 HMAC 서명 키 — 라이선스 서버와 반드시 동일                                                               | TYCHE-PTZ-GOOD-BLESS-2026                       |
| LICENSE_SERVER_URL | ✅   | 라이선스 발급 서버 주소                                                                                           | http://127.0.0.1:4000                           |
| PTZ_DATA_DIR       | ⬜   | 라이선스 파일 저장 경로 — Desktop에서는 Electron이 자동 주입, 웹 단독 실행 시 미설정이면 process.cwd()/data/ 사용 | (자동)                                          |

현재 설정값은 아래와 같다. (유출주의)

```
DATABASE_URL="postgresql://neondb_owner:npg_cP1qQeFoMkO3@ep-patient-waterfall-a1tk4pzw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
NEXTAUTH_SECRET="wdaa3EIyANLmrkF4ENZ6WRs8HDD0zQUJ"
NEXTAUTH_URL="https://localhost:3000"
LICENSE_SECRET="TYCHE-PTZ-GOOD-BLESS-2026"
LICENSE_SERVER_URL="http://127.0.0.1:4000"
```

2. ptzcontroller_desktop (이하 desktop)

| 변수               | 필수 | 설명                                                                 | 예시                                            |
| ------------------ | ---- | -------------------------------------------------------------------- | ----------------------------------------------- |
| DATABASE_URL       | ✅   | PostgreSQL 연결 문자열 (admin과 동일 DB 공유)                        | postgresql://user:pw@host/db?sslmode=require    |
| NEXTAUTH_SECRET    | ✅   | admin과 동일한 값 사용 (같은 DB 공유 시)                             | wdaa3EIyANLmrkF4ENZ6WRs8HDD0zQUJ                |
| NEXTAUTH_URL       | ✅   | 미설정 시 http://localhost:{PORT} 자동 설정                          | http://localhost:3000 / https://your-domain.com |
| LICENSE_SECRET     | ✅   | 라이선스 HMAC 서명 키 — 라이선스 서버와 반드시 동일                  | TYCHE-PTZ-GOOD-BLESS-2026                       |
| LICENSE_SERVER_URL | ✅   | 라이선스 발급 서버 주소                                              | http://127.0.0.1:4000                           |
| PTZ_DATA_DIR       | ⬜   | 설정 불필요 — Electron main.js가 app.getPath('userData')로 자동 주입 | (자동)                                          |

현재 설정값

```
DATABASE_URL="postgresql://neondb_owner:npg_cP1qQeFoMkO3@ep-patient-waterfall-a1tk4pzw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
NEXTAUTH_SECRET="wdaa3EIyANLmrkF4ENZ6WRs8HDD0zQUJ"

# Electron 데스크톱용 자동 추가
NEXTAUTH_URL="https://localhost:3000"
LICENSE_SECRET="TYCHE-PTZ-GOOD-BLESS-2026"
LICENSE_SERVER_URL="http://127.0.0.1:4000"
```

3. ptz-license-server (이하 license)

| 변수           | 필수 | 설명                                                 | 예시                      |
| -------------- | ---- | ---------------------------------------------------- | ------------------------- |
| PORT           | ✅   | 서버포트(기본 4000)                                  | 4000                      |
| LICENSE_SECRET | ✅   | admin, desktop과 반드시 동일한 값                    | TYCHE-PTZ-GOOD-BLESS-2026 |
| ADMIN_PASSWORD | ⬜   | 현재 관리자, 암호(나중에 관리할 수 있도록 해야할 것) | lovetyche!                |

### 핵심 주의사항

```
LICENSE_SECRET 은 세 곳 모두 반드시 동일해야 합니다
  ptzcontroller_admin/.env
  ptzcontroller_desktop/standalone/.env
  ptz-license-server/.env
```

4. 관리자가 사용자에게 제공하기 위해 업로드한 ptz-proxy 실행파일은
   서버의 다음 디렉토리에 저장된다

    "ptzcontroller_admin/public/downloads/"
