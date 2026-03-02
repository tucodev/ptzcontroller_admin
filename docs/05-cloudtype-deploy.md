# Cloudtype.io 배포 가이드

## 목차

1. [개요](#개요)
2. [사전 준비](#사전-준비)
3. [프로젝트 설정](#프로젝트-설정)
4. [Cloudtype 배포](#cloudtype-배포)
5. [환경 변수 설정](#환경-변수-설정)
6. [데이터베이스 연결](#데이터베이스-연결)
7. [배포 후 설정](#배포-후-설정)
8. [문제 해결](#문제-해결)

---

## 주의

```
cloudtype에 배포전에 database 가 구성되어 있어야 함.
local 에서 다음을 실행할 것.

yarn install
yarn prisma generate
yarn prisma migrate dev
yarn prisma db seed
```

## CloudType 설정

<center>
  <img
    src="./cloudtype-setup.png"
    width="680"
    height="2164"
  />
</center>

## 개요

[Cloudtype](https://cloudtype.io)은 한국 기반 클라우드 플랫폼으로, Next.js 애플리케이션을 쉽게 배포할 수 있습니다.

### 특징

- GitHub 연동 자동 배포
- 무료 플랜 제공
- PostgreSQL, MySQL 등 데이터베이스 서비스
- 커스텀 도메인 지원
- SSL 자동 설정

---

## 사전 준비

### 1. 계정 생성

1. [cloudtype.io](https://cloudtype.io) 접속
2. GitHub 또는 이메일로 회원가입
3. 결제 정보 등록 (유료 플랜 사용 시)

### 2. GitHub 저장소 생성

```bash
# 로컬에서 Git 초기화
cd ptzcontroller_admin
git init
git add .
git commit -m "Initial commit"

# GitHub에 푸시
git remote add origin https://github.com/username/ptz-controller.git
git push -u origin main
```

### 3. 필수 파일 확인

```
project_root/
├── ptzcontroller_admin/
│   ├── package.json      # ✅ 필수
│   ├── next.config.js    # ✅ 필수
│   ├── prisma/
│   │   └── schema.prisma # ✅ DB 사용 시
│   └── ...
└── ...
```

---

## 프로젝트 설정

### next.config.js 수정

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone", // Cloudtype 배포 시 권장
    /* tuco remove: 필요시 살린다. --> 현재는 사용안하고 잘 됨
      experimental: {
        outputFileTracingRoot: require("path").join(__dirname, ".."),
    },
    */
    // CORS 설정 (필요 시 ---> 현재는 사용안하고 잘 됨, 필요시 살린다.)
    /* tuco remove
    async headers() {
        return [
            {
                source: "/api/:path*",
                headers: [
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    {
                        key: "Access-Control-Allow-Methods",
                        value: "GET,POST,PUT,DELETE,OPTIONS",
                    },
                ],
            },
        ];
    },
    */
};

module.exports = nextConfig;
```

### package.json 확인

```json
{
    "name": "ptz-controller",
    "version": "1.0.0",
    "scripts": {
        "dev": "next dev",
        "build": "prisma generate && next build",
        "build-cloudtype": "prisma generate && next build",
        "rebuild": "next build",
        "start": "next start",
        "lint": "next lint"
        //"postinstall": "prisma generate"
    },
    "engines": {
        "node": ">=24.0.0"
    }
}
```

### .gitignore 확인

```gitignore
# .gitignore
node_modules/
.next/
.env
.env.local
.env.production.local
data/*.json
```

---> 나의 경우 (tuco) 이렇게만 설정함

```gitignore
# .gitignore
node_modules/
```

---

## Cloudtype 배포

### 1. 프로젝트 생성

1. Cloudtype 대시보드 접속
2. "새 프로젝트" 클릭
3. GitHub 저장소 연결
4. 저장소 선택: `username/ptz-controller`

### 2. 배포 설정

| 설정          | 값                     |
| ------------- | ---------------------- |
| 프레임워크    | Next.js                |
| Node.js 버전  | 18.x                   |
| 빌드 명령어   | `yarn build-cloudtype` |
| 시작 명령어   | `yarn start`           |
| 루트 디렉토리 | `ptzcontroller_admin`  |
| 포트          | 3000                   |

### 3. cloudtype.yaml 설정 (선택)

프로젝트 루트에 `cloudtype.yaml` 생성:

```yaml
# cloudtype.yaml
name: ptz-controller
app: ptzcontroller_admin

services:
    - name: web
      type: nextjs
      node: 24
      build:
          command: yarn build-cloudtype
      start:
          command: yarn start
      env:
          - DATABASE_URL
          - NEXTAUTH_URL
          - NEXTAUTH_SECRET
      resources:
          cpu: 0.5
          memory: 512Mi
```

--> 나의 경우 (tuco)

```
# cloudtype.yaml
name: ptz-controller
app: ptzcontroller_admin

services:
    - name: web
      type: nextjs
      node: 18
      build:
          command: yarn build-cloudtype
      start:
          command: yarn start
      env:
          - DATABASE_URL
          - NEXTAUTH_SECRET
      resources:
          cpu: 0.5
          memory: 512Mi
```

### 4. 배포 실행

1. "배포" 버튼 클릭
2. 빌드 로그 확인
3. 배포 완료 후 URL 확인

---

## 환경 변수 설정

### Cloudtype 대시보드에서 설정

1. 프로젝트 선택
2. "환경 변수" 탭 클릭
3. 변수 추가:

| 변수명          | 값                             | 설명                  |
| --------------- | ------------------------------ | --------------------- |
| DATABASE_URL    | postgresql://...               | 데이터베이스 연결 URL |
| NEXTAUTH_URL    | https://your-app.cloudtype.app | 배포된 앱 URL         |
| NEXTAUTH_SECRET | (랜덤 문자열)                  | 인증 시크릿           |
| NODE_ENV        | production                     | 환경 설정             |

### NEXTAUTH_SECRET 생성

```bash
# 로컬에서 생성
openssl rand -base64 32
# 결과 예: K8v3Ht7LmN9pQwXz2Rf6Yb4Jc1Sd5Ag8
```

---

## 데이터베이스 연결

### Cloudtype PostgreSQL 사용

1. 대시보드에서 "데이터베이스" → "PostgreSQL" 선택
2. 새 데이터베이스 생성
3. 연결 정보 복사
4. DATABASE_URL 환경 변수에 설정

```
postgresql://username:password@host:port/database?sslmode=require
```

### 외부 데이터베이스 연결

**Supabase 사용 시:**

```
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

**Neon 사용 시:**

```
postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require
```

### 데이터베이스 마이그레이션

```bash
# 로컬에서 마이그레이션 생성
DATABASE_URL="your-production-url" npx prisma migrate deploy

# 시드 데이터 (필요 시)
DATABASE_URL="your-production-url" npx prisma db seed
```

---

## 배포 후 설정

### 커스텀 도메인 설정

1. Cloudtype 대시보드 → "도메인" 탭
2. "커스텀 도메인 추가"
3. 도메인 입력: `ptz.yourdomain.com`
4. DNS 설정:
    ```
    CNAME ptz → your-app.cloudtype.app
    ```

### HTTPS/SSL

Cloudtype에서 자동으로 Let's Encrypt SSL 인증서 발급

### 자동 배포 설정

1. GitHub Actions 또는 Cloudtype 자동 배포 활성화
2. `main` 브랜치 푸시 시 자동 배포

```yaml
# .github/workflows/deploy.yml (선택)
name: Deploy to Cloudtype

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Deploy
              uses: cloudtype/deploy-action@v1
              with:
                  token: ${{ secrets.CLOUDTYPE_TOKEN }}
                  project: your-project-id
```

---

## Proxy 모드 고려사항

### 중요: Cloudtype에서의 Proxy 모드

Cloudtype에 배포된 서버는 Direct 모드로 PTZ 카메라를 제어할 수 없습니다 (Private 네트워크 접근 불가).

**해결 방법:**

1. **Proxy 모드 사용**: 사용자 PC에서 ptz-proxy 실행
2. **VPN 연결**: 카메라 네트워크와 VPN 연결
3. **포트 포워딩**: 카메라에 Public IP 할당

### 권장 아키텍처

```
[Cloudtype Server]     [사용자 PC]          [로컬 네트워크]
      │                    │                     │
  웹 앱 호스팅      ←──── 브라우저 ────→    PTZ Proxy
  (UI + API)               │                     │
                           └──── WebSocket ──────┘
                                                  │
                                                  ▼
                                            [PTZ Camera]
```

---

## 문제 해결

### 빌드 실패: Prisma Client

```bash
# package.json에 postinstall 추가
"scripts": {
  "postinstall": "prisma generate"
}
```

---> 또는

```
다음을 재확인

(1) package.json 파일을 열고 다음 라인이 정상적으로 들어 있는지
"build-cloudtype": "prisma generate && next build",


package.json 전체 내용
{
    "name": "ptz-controller",
    "version": "1.0.0",
    "scripts": {
        "dev": "next dev",
        "build": "next build",
        "build-cloudtype": "prisma generate && next build", // <--- tuco add, cloude type build command 에 build-cloudtype 이라고 입력한다.
        "start": "next start",
        "postinstall": "prisma generate"
    },
    "engines": {
        "node": ">=18.0.0"
    }
}

(2) cloudytype 배포 설정에
    build command 가  아래처럼 설정되어 있는지

build command  yarn build-cloudtype
```

### 빌드 실패: 메모리 부족

Cloudtype 대시보드에서 리소스 증가:

- CPU: 1.0
- Memory: 1024Mi

### 환경 변수 미적용

1. 환경 변수 설정 후 재배포 필요
2. 변수명 대소문자 확인
3. 따옴표 없이 값만 입력

### CORS 에러

```javascript
// next.config.js
module.exports = {
    async headers() {
        return [
            {
                source: "/api/:path*",
                headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
            },
        ];
    },
};
```

### 데이터베이스 연결 실패

1. DATABASE_URL 형식 확인
2. SSL 모드 확인 (`?sslmode=require`)
3. 방화벽 설정 확인 (Cloudtype IP 허용)

---

## 비용 최적화

### 무료 플랜 제한

- CPU: 0.5 Core
- Memory: 512MB
- 월 트래픽: 10GB

### 유료 플랜 권장 사항

- 동시 접속자가 많을 경우
- 데이터베이스 연동 시
- 커스텀 도메인 사용 시

### 리소스 모니터링

대시보드에서 CPU, 메모리, 네트워크 사용량 확인 가능
