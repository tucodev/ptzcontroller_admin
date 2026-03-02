# PTZ Controller 빌드 가이드

## 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [의존성 설치](#의존성-설치)
3. [개발 모드 실행](#개발-모드-실행)
4. [프로덕션 빌드](#프로덕션-빌드)
5. [환경 변수 설정](#환경-변수-설정)

---

## 개발 환경 설정

### 필수 소프트웨어

| 소프트웨어 | 버전        | 용도          |
| ---------- | ----------- | ------------- |
| Node.js    | 18.x 이상   | 런타임        |
| Yarn       | 1.22.x 이상 | 패키지 매니저 |
| Git        | 2.x 이상    | 버전 관리     |

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
# 프로젝트 디렉토리로 이동
cd ptz_controller/nextjs_space

# 의존성 설치
yarn install

# Prisma 클라이언트 생성 (아래명령 실행전 [위 명령전 확인] 사항을 확인할 것)
yarn prisma generate
```

[위 명령 전 확인]

위 명령 실행시 에러가 발생할 수 있다.
그러므로 미리 다음 파일을 찾아 미리 수정 점검하다.

(1) prisma/schema.prisma 파일 수정

        prismagenerator client {
          provider = "prisma-client-js"
          // output 항목이 있다면 제거하거나 아래처럼 수정
          // output   = "../../../home/ubuntu/..."  ← 이 줄이 문제를 일으킴(리눅스외 OS시)
        }
        output 줄을 삭제.

(2) next.config.js 파일 수정

       const path = require("path");

       /** @type {import('next').NextConfig} */
       const nextConfig = {
           // *** tuco add ***
           output: "standalone", // 👈 이 줄을 추가하세요! standalone
           // *** tuco remove ***
           // 아래사항은 삭제
           // distDir: process.env.NEXT_DIST_DIR || '.next',
           // output: process.env.NEXT_OUTPUT_MODE,
           // experimental: {
           //   outputFileTracingRoot: path.join(__dirname, '../'),
           // },
           eslint: {
               ignoreDuringBuilds: true,
           },
           typescript: {
               ignoreBuildErrors: false,
           },
           images: { unoptimized: true },
       };

       module.exports = nextConfig;

### 주요 의존성

| 패키지        | 용도                   |
| ------------- | ---------------------- |
| next          | Next.js 프레임워크     |
| react         | UI 라이브러리          |
| next-auth     | 인증                   |
| prisma        | 데이터베이스 ORM       |
| framer-motion | 애니메이션             |
| ws            | WebSocket (Proxy 모드) |
| next-themes   | 테마 관리              |

---

## 개발 모드 실행

### 데이터베이스 설정 (최초 1회)

```bash
# 데이터베이스 마이그레이션
yarn prisma migrate dev
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

# 시드 데이터 생성 (테스트 계정)

```bash
yarn prisma db seed
```

### 개발 서버 시작

아래 시작 명령전 .next 폴더 지울것

```bash
yarn dev
```

브라우저에서 `http://localhost:3000` 접속

### 개발 서버 옵션

```bash
# 특정 포트로 실행
PORT=3001 yarn dev

# 외부 접근 허용
yarn dev --hostname 0.0.0.0
```

---

## 프로덕션 빌드

### 빌드 실행

build 중 에러가 나면, 아래 build 명령 전 .next 폴더 지울 것

```bash
# 프로덕션 빌드
yarn build
```

빌드 결과물은 `.next` 디렉토리에 생성됩니다.

### 프로덕션 서버 실행

```bash
yarn start
```

### Standalone 빌드 (권장)

`next.config.js`에서 standalone 출력 설정:

```javascript
// next.config.js
module.exports = {
    output: "standalone",
    // ... 기타 설정
};
```

```bash
# build 중 에러가 나면, 아래 build 명령 전 .next 폴더 지울 것

# 빌드
yarn build

# standalone 실행
node .next/standalone/server.js
```

### 빌드 결과 구조

```
.next/
├── standalone/          # 독립 실행 가능한 서버
│   ├── server.js        # 메인 서버 파일
│   ├── node_modules/    # 필수 의존성만 포함
│   └── .next/           # 빌드된 애플리케이션
├── static/              # 정적 파일
└── cache/               # 빌드 캐시
```

---

## 환경 변수 설정

일부는 빌드전 설정하라

### .env 파일 생성

```bash
# .env 파일 예시
cp .env.example .env
```

### 필수 환경 변수

```env
# 데이터베이스 URL
DATABASE_URL="postgresql://user:password@localhost:5432/ptz_controller"

# NextAuth 설정
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# 앱 URL (프로덕션)
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### 환경별 설정들

```bash
# 개발 환경
.env.development

# 프로덕션 환경
.env.production

# 로컬 오버라이드
.env.local
```

### NEXTAUTH_SECRET 생성

```bash
# OpenSSL로 시크릿 생성
openssl rand -base64 32
```

---

## 빌드 최적화

### 번들 분석

```bash
# 번들 분석기 설치
yarn add -D @next/bundle-analyzer

# 분석 실행
ANALYZE=true yarn build
```

### 빌드 캐시 활용

```bash
# 캐시 삭제
rm -rf .next

# 캐시 유지하며 빌드
yarn build
```

### TypeScript 검사

```bash
# 타입 체크만 실행
yarn tsc --noEmit

# 빌드 시 타입 체크 포함
yarn build
```

---

## 문제 해결

### 빌드 실패: Prisma Client 미생성

```bash
yarn prisma generate
```

### 빌드 실패: 메모리 부족

```bash
# 메모리 제한 늘리기
NODE_OPTIONS="--max-old-space-size=4096" yarn build
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```
