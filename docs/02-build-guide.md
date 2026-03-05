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
| Node.js    | **24.x 이상** | 런타임        |
| Yarn       | 1.22.x 이상   | 패키지 매니저 |
| Git        | 2.x 이상      | 버전 관리     |

### Node.js 설치

```bash
# Windows (winget)
winget install OpenJS.NodeJS.LTS
# 또는 nvm 사용
nvm install 24

# macOS (Homebrew)
brew install node@24

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
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
  // output 항목이 있다면 제거할 것 (리눅스 외 OS에서 경로 오류 발생)
  // 예 output   = "../../../home/ubuntu/..."  ← 이 줄이 문제를 일으킴(리눅스외 OS시)
}
```

**(2) `next.config.js` 확인**

```javascript
const nextConfig = {
    // *** tuco add ***
    output: "standalone", // ← 반드시 있어야 함 (standalone 빌드)
    // *** tuco remove ***
    // 아래사항은 삭제
    // distDir: process.env.NEXT_DIST_DIR || '.next',
    // output: process.env.NEXT_OUTPUT_MODE,
    // experimental: {
    //   outputFileTracingRoot: path.join(__dirname, '../'),
    // },
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: false },
    images: { unoptimized: true },
};
module.exports = nextConfig;
```

### 주요 의존성

| 패키지         | 버전    | 용도                           |
| -------------- | ------- | ------------------------------ |
| next           | 14.2.28 | Next.js 프레임워크             |
| react          | 18.2.0  | UI 라이브러리                  |
| next-auth      | 4.24.11 | 인증 (JWT 세션)                |
| @prisma/client | 6.7.0   | 데이터베이스 ORM               |
| framer-motion  | 10.x    | 애니메이션                     |
| ws             | 8.x     | WebSocket (Proxy 모드)         |
| next-themes    | 0.3.0   | 테마 관리                      |
| archiver       | 7.x     | ZIP 생성 (Proxy 파일 다운로드) |

---

## 개발 모드 실행

### 데이터베이스 초기 설정 (최초 1회)

```bash
# 마이그레이션 실행
yarn prisma migrate dev --name init
```

> **프롬프트가 나올 경우** `init` 입력

```
      위 명령 입력시 처음에 다음 프롬프트가 나온다.

          "Enter a name for the new migration: »"


      위 프롬프트는 마이그레이션 이름을 입력하는 프롬프트입니다.
      해당 변경 사항을 설명하는 간단한 이름을 입력하면 됩니다.
      (참고) yarn prisma migrate dev --name init <-- 위 명령 대신 이것을 실행하면 프롬프트 안나오고 초기화 될 것이다.

      (1) 권장 입력값
          초기 설정인 경우:

              init  <--- 우리는 이걸 입력하자

          또는

              initial_setup


      (2) 특정 변경인 경우 (예시):

          add_user_table - 사용자 테이블 추가 시
          add_session - 세션 테이블 추가 시
          add_camera_config - 카메라 설정 추가 시


      (주의) 위 명령은 db 생성하는 것으로 이미 있다면 하지 않아도 된다.
             만약 중복 실행했다면, 질문에 답하면된다. 최악은 중요한 db가
             Reset 되는 것이다.

      [참고] 일부러 Reset하는 명령은

          yarn prisma migrate reset

          ? Are you sure you want to reset your database? All data will be lost. » (y/N) y
```

# Seed 데이터 생성 (테스트 계정 tyche@tyche.ooo)

```bash
# 샘플 로그인 정보 1 계정 등록함

yarn prisma db seed
```

> ⚠️ 이미 DB가 있는 경우 `migrate dev` 생략 가능.  
> 실수로 중복 실행 시 `yarn prisma migrate reset` 으로 초기화 (데이터 삭제 주의).

## DB 툴

이 툴로 DB의 데이터 확인 및 수정 가능함.

```
npx prisma studio "postgresql://neondb_owner:npg_cP1qQeFoMkO3@ep-patient-waterfall-a1tk4pzw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

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

### `.env` 파일

```env
# PostgreSQL 데이터베이스 URL (Neon 사용 예시)
DATABASE_URL="postgresql://username:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# NextAuth 설정
NEXTAUTH_SECRET="your-random-secret-key"
NEXTAUTH_URL="http://localhost:3000"   # 로컬 개발용
# NEXTAUTH_URL="https://your-domain.cloudtype.app"  # 운영 배포 시
```

> **Electron 데스크톱 빌드 시**: `NEXTAUTH_URL`이 없으면 `npm run copy:standalone` 실행 시 자동으로 `http://localhost:3000`이 추가됩니다.

### NEXTAUTH_SECRET 생성

```bash
openssl rand -base64 32
```

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
