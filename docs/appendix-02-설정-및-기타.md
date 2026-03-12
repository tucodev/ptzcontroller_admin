# 설정 및 기타

## 환경변수

### 1. ptzcontroller_admin (이하 admin)

`.env` 파일에 다음 환경변수를 설정합니다.

| 변수               | 필수 | 설명                                                           | 예시                                            |
| ------------------ | ---- | -------------------------------------------------------------- | ----------------------------------------------- |
| PORT               | ⬜   | 서버 포트 (기본 3000)                                          | 3000                                            |
| DB_TYPE            | ⬜   | 저장소 타입: `sqlite`(기본) 또는 `neon`                        | neon                                            |
| STORAGE_MODE       | ⬜   | DB_TYPE=neon일 때: `on`(Neon+SQLite), `off`(Neon만, 기본)      | off                                             |
| DATABASE_URL       | ✅   | PostgreSQL 연결 문자열 (DB_TYPE=neon 시 필수)                  | postgresql://user:pw@host/db?sslmode=require    |
| NEXTAUTH_SECRET    | ✅   | JWT 서명 키 (32자 이상 랜덤 문자열)                            | (openssl rand -base64 32)                       |
| NEXTAUTH_URL       | ✅   | 앱 접속 URL (NextAuth 콜백용)                                  | http://localhost:3000                           |
| LICENSE_SECRET     | ✅   | 라이선스 HMAC 서명 키 — 라이선스 서버와 반드시 동일            | TYCHE-PTZ-GOOD-BLESS-2026                       |
| LICENSE_SERVER_URL | ✅   | 라이선스 발급 서버 주소                                        | http://127.0.0.1:4000                           |
| JWT_SECRET         | ✅   | 관리자 대시보드 JWT 서명 키                                    | (랜덤 문자열)                                   |
| JWT_EXPIRES        | ⬜   | JWT 만료 시간 (기본 8h)                                        | 8h                                              |
| PROXY_TOKEN_SECRET | ⬜   | PTZ Proxy 토큰 인증 서명 키 — 미설정 시 NEXTAUTH_SECRET 사용   | (랜덤 문자열)                                   |
| PTZ_DATA_DIR       | ⬜   | 데이터 저장 경로 — 미설정 시 process.cwd()/data/               | (자동)                                          |
| SMTP_HOST          | ⬜   | SMTP 서버 호스트 (비밀번호 재설정용)                           | smtp.gmail.com                                  |
| SMTP_PORT          | ⬜   | SMTP 포트                                                      | 587                                             |
| SMTP_SECURE        | ⬜   | SMTP TLS 사용 여부                                             | false                                           |
| SMTP_USER          | ⬜   | SMTP 계정                                                      | your-email@gmail.com                            |
| SMTP_PASSWORD      | ⬜   | SMTP 비밀번호 (Gmail 앱 비밀번호)                              | (앱 비밀번호)                                   |
| APP_URL            | ⬜   | 비밀번호 재설정 링크에 사용되는 앱 URL                         | http://localhost:3000                           |

### 저장소 모드 (DB_TYPE + STORAGE_MODE)

| DB_TYPE | STORAGE_MODE | 동작                                          |
| ------- | ------------ | --------------------------------------------- |
| sqlite  | (무시)       | SQLite만 사용 (단독 서버 배포용)              |
| neon    | off          | Neon(PostgreSQL)만 사용 (기본값)              |
| neon    | on           | Neon + SQLite 이중 저장 (백업)                |

> ⚠️ JSON 파일 저장(`data/users/` 등)은 **더 이상 사용하지 않습니다**.
> 모든 설정 데이터는 DB(Neon 또는 SQLite)에만 저장됩니다.

> Desktop 버전(`PTZ_DESKTOP_MODE=true`)은 STORAGE_MODE와 무관하게 항상 Neon+SQLite 이중 저장.
> 오프라인 시 SQLite 폴백. Admin 버전은 DB 접속 불가 시 에러 반환.

### 2. ptzcontroller_desktop (이하 desktop)

| 변수               | 필수 | 설명                                                                 | 예시                                            |
| ------------------ | ---- | -------------------------------------------------------------------- | ----------------------------------------------- |
| DATABASE_URL       | ✅   | PostgreSQL 연결 문자열 (admin과 동일 DB 공유)                        | postgresql://user:pw@host/db?sslmode=require    |
| NEXTAUTH_SECRET    | ✅   | admin과 동일한 값 사용 (같은 DB 공유 시)                             | (admin과 동일)                                  |
| NEXTAUTH_URL       | ✅   | 미설정 시 http://localhost:{PORT} 자동 설정                          | http://localhost:3000                           |
| LICENSE_SECRET     | ✅   | 라이선스 HMAC 서명 키 — 라이선스 서버와 반드시 동일                  | (admin과 동일)                                  |
| LICENSE_SERVER_URL | ✅   | 라이선스 발급 서버 주소                                              | http://127.0.0.1:4000                           |
| PTZ_DATA_DIR       | ⬜   | 설정 불필요 — Electron main.js가 app.getPath('userData')로 자동 주입 | (자동)                                          |

### 3. ptz-license-server (이하 license)

| 변수           | 필수 | 설명                                    | 예시                      |
| -------------- | ---- | --------------------------------------- | ------------------------- |
| PORT           | ✅   | 서버 포트 (기본 4000)                   | 4000                      |
| LICENSE_SECRET | ✅   | admin, desktop과 반드시 동일한 값       | (admin과 동일)            |
| ADMIN_PASSWORD | ⬜   | 관리자 비밀번호                         | (보안 문자열)             |

### 핵심 주의사항

```
LICENSE_SECRET 은 세 곳 모두 반드시 동일해야 합니다:
  ptzcontroller_admin/.env
  ptzcontroller_desktop/standalone/.env
  ptz-license-server/.env
```

## 기타

### Proxy 파일 저장 위치

관리자가 사용자에게 제공하기 위해 업로드한 ptz-proxy 실행파일은 다음 디렉토리에 저장됩니다:

```
ptzcontroller_admin/public/downloads/
```

### SMTP 설정 (Gmail)

Gmail을 SMTP로 사용하려면:
1. Google 계정 → 보안 → 2단계 인증 활성화
2. 앱 비밀번호 생성 (Mail, Windows PC)
3. 생성된 16자리 비밀번호를 `SMTP_PASSWORD`에 입력

### 비밀번호 재설정 API

| 엔드포인트 | 용도 |
|-----------|------|
| `POST /api/admin/users/reset-password` | 관리자 강제 리셋 (임시 비밀번호 → 이메일) |
| `POST /api/auth/forgot-password` | 셀프서비스 토큰 요청 (재설정 링크 → 이메일) |
| `POST /api/auth/reset-password` | 셀프서비스 비밀번호 변경 (토큰 + 새 비밀번호) |
