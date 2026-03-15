# 기본 사항

---

## neon 접속 정보: github로 tucodev@gmail.com

```
# PTZ Controller Desktop — 환경변수 설정 파일
#
# 사용법:
# 1. 이 파일을 .env-in-standalone 이름으로 복사 (또는 standalone/.env 로 직접 복사)
# 2. 아래 항목들을 실제 값으로 채워 넣으세요
# 3. .env-in-standalone / standalone/.env 는 절대 Git에 커밋하지 마세요
#
# copy:standalone 실행 시 ptzcontroller_admin/.env 를 자동으로 standalone/.env 로 복사합니다.
# 이 파일은 개발자 참조용 템플릿입니다.

# Port (admin Server)
#PORT=3000
# Port (license Server)
PORT=4000

# ── SQLite 백업 모드 (DB_TYPE=neon 일 때만 유효) ─────────────
# ptzcontroller_desktop, license_server, ptz_proxy 에서는 의미 없음
#
# on : Neon 저장 + SQLite에도 동기화 (이중 저장)
# off : Neon에만 저장 (기본값)
# DB_TYPE=sqlite 이면 이 값은 무시됨 (SQLite가 유일한 저장소)
STORAGE_MODE=off

# ── DB 선택 ───────────────────────────────────────────────────
# ptzcontroller_desktop, license_server, ptz_proxy 에서는 의미 없음

#
# sqlite : 로컬/온프레미스 (기본값, data/license.db 파일 생성)
# neon : 클라우드 (DATABASE_URL 필수)
# 버그 수정: 기존 파일에 주석 없는 "or" 라인이 있어 dotenv 파싱 오류 발생
# → 두 줄 모두 주석 처리, 사용할 것만 주석 해제
#DB_TYPE=sqlite
# or
DB_TYPE=neon

# ── 데이터베이스 (필수) ───────────────────────────────────────
# PostgreSQL 접속 URL (NeonDB, Supabase, 로컬 PG 등)
DATABASE_URL="postgresql://neondb_owner:npg_cP1qQeFoMkO3@ep-patient-waterfall-a1tk4pzw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ── NextAuth (필수) ───────────────────────────────────────────
# 충분히 길고 랜덤한 문자열 (openssl rand -base64 32)
NEXTAUTH_SECRET="wdaa3EIyANLmrkF4ENZ6WRs8HDD0zQUJ"
# Electron 내장 서버는 반드시 http (https 사용 시 로그인 실패)
NEXTAUTH_URL="http://localhost:3000"

# ── 라이선스 (선택) ───────────────────────────────────────────
# 오프라인 라이선스 서명에 사용하는 시크릿
LICENSE_SECRET="TYCHE-PTZ-GOOD-BLESS-2026"
# 온라인 라이선스 발급 서버 URL (없으면 오프라인 모드만 동작)
LICENSE_SERVER_URL="http://localhost:4000"
# 관리자 대시보드 비밀번호 (Basic Auth)
JWT_SECRET=IMGOINGTOGOODHEAVENHELLOTYCHE23
JWT_EXPIRES=8h

# ── 초기 superadmin 계정 시드 ────────────────────────────────
# admins 테이블이 비어 있을 때 최초 1회만 생성
# 서버 실행 후 대시보드에서 비밀번호 변경 후 아래 항목 제거 권장
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=hellotyche!

# P-48 추가: 이메일 설정 (SMTP)
#
# 1. Google 계정 → 보안 → 앱 비밀번호
# 2. 앱 선택: Mail
# 3. 기기 선택: Windows PC (또는 해당 OS)
# 4. 생성된 16자리 비밀번호를 SMTP_PASSWORD에 입력
#

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=cumtyche@gmail.com
SMTP_PASSWORD=wbjnrgeyonwftrvi
APP_URL=http://localhost:3000

# sms 정보
ALIGO_API_KEY=ave4ls1tcjg1m3gpeybp2mnw07zemjmr
ALIGO_USER_ID=tuco
ALIGO_SENDER=01094832363
```

---

# 설정 및 기타

## 환경변수

### 1. ptzcontroller_admin (이하 admin)

`.env` 파일에 다음 환경변수를 설정합니다.

| 변수               | 필수 | 설명                                                         | 예시                                         |
| ------------------ | ---- | ------------------------------------------------------------ | -------------------------------------------- |
| PORT               | ⬜   | 서버 포트 (기본 3000)                                        | 3000                                         |
| DB_TYPE            | ⬜   | 저장소 타입: `sqlite`(기본) 또는 `neon`                      | neon                                         |
| STORAGE_MODE       | ⬜   | DB_TYPE=neon일 때: `on`(Neon+SQLite), `off`(Neon만, 기본)    | off                                          |
| DATABASE_URL       | ✅   | PostgreSQL 연결 문자열 (DB_TYPE=neon 시 필수)                | postgresql://user:pw@host/db?sslmode=require |
| NEXTAUTH_SECRET    | ✅   | JWT 서명 키 (32자 이상 랜덤 문자열)                          | (openssl rand -base64 32)                    |
| NEXTAUTH_URL       | ✅   | 앱 접속 URL (NextAuth 콜백용)                                | http://localhost:3000                        |
| LICENSE_SECRET     | ✅   | 라이선스 HMAC 서명 키 — 라이선스 서버와 반드시 동일          | TYCHE-PTZ-GOOD-BLESS-2026                    |
| LICENSE_SERVER_URL | ✅   | 라이선스 발급 서버 주소                                      | http://127.0.0.1:4000                        |
| JWT_SECRET         | ✅   | 관리자 대시보드 JWT 서명 키                                  | (랜덤 문자열)                                |
| JWT_EXPIRES        | ⬜   | JWT 만료 시간 (기본 8h)                                      | 8h                                           |
| PROXY_TOKEN_SECRET | ⬜   | PTZ Proxy 토큰 인증 서명 키 — 미설정 시 NEXTAUTH_SECRET 사용 | (랜덤 문자열)                                |
| PTZ_DATA_DIR       | ⬜   | 데이터 저장 경로 — 미설정 시 process.cwd()/data/             | (자동)                                       |
| SMTP_HOST          | ⬜   | SMTP 서버 호스트 (비밀번호 재설정용)                         | smtp.gmail.com                               |
| SMTP_PORT          | ⬜   | SMTP 포트                                                    | 587                                          |
| SMTP_SECURE        | ⬜   | SMTP TLS 사용 여부                                           | false                                        |
| SMTP_USER          | ⬜   | SMTP 계정                                                    | your-email@gmail.com                         |
| SMTP_PASSWORD      | ⬜   | SMTP 비밀번호 (Gmail 앱 비밀번호)                            | (앱 비밀번호)                                |
| APP_URL            | ⬜   | 비밀번호 재설정 링크에 사용되는 앱 URL                       | http://localhost:3000                        |

### 저장소 모드 (DB_TYPE + STORAGE_MODE)

| DB_TYPE | STORAGE_MODE | 동작                             |
| ------- | ------------ | -------------------------------- |
| sqlite  | (무시)       | SQLite만 사용 (단독 서버 배포용) |
| neon    | off          | Neon(PostgreSQL)만 사용 (기본값) |
| neon    | on           | Neon + SQLite 이중 저장 (백업)   |

> ⚠️ JSON 파일 저장(`data/users/` 등)은 **더 이상 사용하지 않습니다**.
> 모든 설정 데이터는 DB(Neon 또는 SQLite)에만 저장됩니다.

> Desktop 버전(`PTZ_DESKTOP_MODE=true`)은 STORAGE_MODE와 무관하게 항상 Neon+SQLite 이중 저장.
> 오프라인 시 SQLite 폴백. Admin 버전은 DB 접속 불가 시 에러 반환.

### 2. ptzcontroller_desktop (이하 desktop)

| 변수               | 필수 | 설명                                                                 | 예시                                         |
| ------------------ | ---- | -------------------------------------------------------------------- | -------------------------------------------- |
| DATABASE_URL       | ✅   | PostgreSQL 연결 문자열 (admin과 동일 DB 공유)                        | postgresql://user:pw@host/db?sslmode=require |
| NEXTAUTH_SECRET    | ✅   | admin과 동일한 값 사용 (같은 DB 공유 시)                             | (admin과 동일)                               |
| NEXTAUTH_URL       | ✅   | 미설정 시 http://localhost:{PORT} 자동 설정                          | http://localhost:3000                        |
| LICENSE_SECRET     | ✅   | 라이선스 HMAC 서명 키 — 라이선스 서버와 반드시 동일                  | (admin과 동일)                               |
| LICENSE_SERVER_URL | ✅   | 라이선스 발급 서버 주소                                              | http://127.0.0.1:4000                        |
| PTZ_DATA_DIR       | ⬜   | 설정 불필요 — Electron main.js가 app.getPath('userData')로 자동 주입 | (자동)                                       |

### 3. ptz-license-server (이하 license)

| 변수           | 필수 | 설명                              | 예시           |
| -------------- | ---- | --------------------------------- | -------------- |
| PORT           | ✅   | 서버 포트 (기본 4000)             | 4000           |
| LICENSE_SECRET | ✅   | admin, desktop과 반드시 동일한 값 | (admin과 동일) |
| ADMIN_PASSWORD | ⬜   | 관리자 비밀번호                   | (보안 문자열)  |

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

| 엔드포인트                             | 용도                                          |
| -------------------------------------- | --------------------------------------------- |
| `POST /api/admin/users/reset-password` | 관리자 강제 리셋 (임시 비밀번호 → 이메일)     |
| `POST /api/auth/forgot-password`       | 셀프서비스 토큰 요청 (재설정 링크 → 이메일)   |
| `POST /api/auth/reset-password`        | 셀프서비스 비밀번호 변경 (토큰 + 새 비밀번호) |
