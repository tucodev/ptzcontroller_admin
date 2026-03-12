# PTZ Controller 빌드 가이드

## 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [의존성 설치](#의존성-설치)
3. [개발 모드 실행](#개발-모드-실행)
4. [프로덕션 빌드](#프로덕션-빌드)
5. [환경 변수 설정](#환경-변수-설정)
6. [문제 해결](#문제-해결)

---

## 개발 환경 설정

### 필수 소프트웨어

| 소프트웨어 | 버전          | 용도          |
| ---------- | ------------- | ------------- |
| Node.js    | **18.x 이상** | 런타임        |
| Yarn       | 1.22.x 이상   | 패키지 매니저 |
| Git        | 2.x 이상      | 버전 관리     |

## 빌드 최종 요약

### 1. 환경 변수 설정

```
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
DB_TYPE=neon          # 또는 sqlite
STORAGE_MODE=off      # neon 모드일 때: on=SQLite 백업, off=Neon만
```

### 2. 빌드 및 테스트

```bash
cd ptzcontroller_admin
npm install
npx prisma generate
npm run build
npm run dev
```

### 3. 라이선스 흐름 테스트

```
# GET /api/license/verify → 라이선스 상태 확인
# GET /api/license/request → .ptzreq 파일 생성
# POST /api/license/verify → 라이선스 업로드
```

### 4. 오프라인 DB 테스트 (Desktop 전용)

```
# DB 연결 끊은 후 Desktop 앱에서 로그인 시도 → offline-db 인증
```

---

## 빌드 상세

### Node.js 설치

```bash
# Windows (winget)
winget install OpenJS.NodeJS.LTS

# macOS (Homebrew)
brew install node@18

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Yarn 설치

```bash
npm install -g yarn
```

---

## 의존성 설치

### 프로젝트 클론 및 설치

```bash
cd ptzcontroller_admin
yarn install
```

### Prisma 클라이언트 생성

```bash
yarn prisma generate
```

> ⚠️ **실행 전 반드시 확인:**

**(1) `prisma/schema.prisma` 확인**

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "windows", "linux-musl-arm64-openssl-3.0.x"]
}
```

**(2) `next.config.js` 확인**

```javascript
const nextConfig = {
    output: "standalone", // ← 반드시 있어야 함 (standalone 빌드)
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: false },
    images: { unoptimized: true },
};
module.exports = nextConfig;
```

### 주요 의존성

| 패키지         | 용도                             |
| -------------- | -------------------------------- |
| next 14.x      | Next.js 프레임워크               |
| react 18.x     | UI 라이브러리                    |
| next-auth 4.x  | 인증 (JWT 세션)                  |
| @prisma/client | 데이터베이스 ORM                 |
| better-sqlite3 | SQLite 저장소 (오프라인/백업)    |
| nodemailer     | SMTP 이메일 발송 (비밀번호 리셋) |
| ws             | WebSocket (Proxy 모드)           |
| next-themes    | 테마 관리                        |
| archiver       | ZIP 생성 (Proxy 파일 다운로드)   |

---

## 개발 모드 실행

### 데이터베이스 초기 설정 (최초 1회)

```bash
# 이미 배포된 DB에 적용
yarn prisma migrate deploy

# 또는 개발 환경에서 새 DB 생성
yarn prisma migrate dev --name init
```

> **`migrate dev` 프롬프트가 나올 경우**: 마이그레이션 이름 입력 (예: `init`)

> ⚠️ 이미 DB가 있는 경우 `migrate dev` 생략 가능.
> DB 전체 초기화: `yarn prisma migrate reset` (데이터 삭제 주의).

### Seed 데이터 생성 (테스트 계정)

```bash
yarn prisma db seed
```

### DB 조회 도구

```bash
npx prisma studio
```

> Prisma Studio는 `.env`의 `DATABASE_URL`을 자동으로 읽습니다.

### 개발 서버 시작

```bash
# .next 캐시 삭제 후 시작 권장
rm -rf .next    # Windows: rmdir /s /q .next

yarn dev
```

브라우저에서 `http://localhost:3000` 접속

```bash
# 특정 포트로 실행
PORT=3001 yarn dev

# 외부 접근 허용
yarn dev --hostname 0.0.0.0
```

---

## 프로덕션 빌드

### 빌드 실행

```bash
# 빌드 전 .next 폴더 삭제 권장 (캐시 문제 방지)
rm -rf .next

yarn build
# 내부적으로: prisma generate && next build
```

### 빌드 결과 구조

```
.next/
├── standalone/          ← 독립 실행 가능한 서버
│   ├── server.js        ← 메인 서버 파일
│   ├── node_modules/    ← 필수 의존성만 포함
│   └── .next/           ← 빌드된 앱
├── static/              ← 정적 파일
└── cache/               ← 빌드 캐시
```

### Standalone 서버 실행

```bash
node .next/standalone/server.js
```

또는

```bash
yarn start   # next start (standalone 아닌 일반 모드)
```

### Cloudtype 배포용 빌드

```bash
yarn build-cloudtype
# 내부적으로: prisma generate && next build (build와 동일)
```

---

## 환경 변수 설정

### `.env` 파일 구조

```env
# ── 포트 ──
PORT=3000

# ── 저장소 설정 ──
# DB_TYPE: sqlite(기본) 또는 neon
DB_TYPE=neon

# STORAGE_MODE: DB_TYPE=neon일 때만 유효
#   on  = Neon + SQLite 이중 저장
#   off = Neon만 사용 (기본)
STORAGE_MODE=off

# ── 데이터베이스 ──
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# ── NextAuth ──
NEXTAUTH_SECRET="(openssl rand -base64 32로 생성)"
NEXTAUTH_URL="http://localhost:3000"

# ── 라이선스 ──
LICENSE_SECRET="your-license-secret"
LICENSE_SERVER_URL="http://localhost:4000"

# ── JWT ──
JWT_SECRET=your-jwt-secret
JWT_EXPIRES=8h

# ── SMTP (비밀번호 재설정용) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
APP_URL=http://localhost:3000
```

> **Electron 데스크톱 빌드 시**: `NEXTAUTH_URL`이 없으면 `npm run copy:standalone` 실행 시 자동으로 `http://localhost:3000`이 추가됩니다.

### NEXTAUTH_SECRET 생성

```bash
openssl rand -base64 32
```

### 저장소 모드 설명

| DB_TYPE | STORAGE_MODE | 동작                           |
| ------- | ------------ | ------------------------------ |
| sqlite  | (무시)       | SQLite만 사용                  |
| neon    | off          | Neon(PostgreSQL)만 사용        |
| neon    | on           | Neon + SQLite 이중 저장 (백업) |

> Desktop 버전(`PTZ_DESKTOP_MODE=true`)은 STORAGE_MODE와 무관하게 항상 Neon+SQLite 이중 저장.
> Admin 버전은 DB 접속 불가 시 에러 반환 (오프라인 폴백 없음).

---

## 문제 해결

### 빌드 실패: Prisma Client 미생성

```bash
yarn prisma generate
```

### 빌드 실패: 메모리 부족

```bash
NODE_OPTIONS="--max-old-space-size=4096" yarn build
```

### 빌드 후 로그인이 안 됨

`.env` 파일에 `NEXTAUTH_SECRET`과 `NEXTAUTH_URL`이 설정되어 있는지 확인.

### `yarn dev` 후 변경사항이 반영 안 됨

```bash
rm -rf .next
yarn dev
```

### TypeScript 타입 오류

```bash
yarn tsc --noEmit
```

### Prisma generate EPERM 에러 (Windows)

`query_engine-windows.dll.node` 파일이 실행 중인 Node 프로세스에 의해 잠겨있는 경우 발생.
개발 서버(`yarn dev`)를 중지한 후 `yarn prisma generate` 재실행.
