# PTZ Controller 데스크톱 EXE 빌드 가이드

## 개요

`ptzcontroller_desktop/` 은 Next.js 웹앱(`ptzcontroller_admin/`)을  
**Electron으로 감싸 Windows EXE 파일로 패키징**하는 프로젝트입니다.

### 폴더 구조 (전제 조건)

```
(상위 폴더)/
├── ptzcontroller_admin/       ← Next.js 웹앱 소스 (원본)
└── ptzcontroller_desktop/     ← Electron 래퍼 (이 폴더)
    ├── electron/
    │   ├── main.js            ← Electron 메인 프로세스
    │   └── preload.js
    ├── scripts/
    │   ├── copy-standalone.js ← standalone 복사 스크립트
    │   └── bundle-node.js     ← Node.js 포터블 번들 스크립트
    ├── assets/
    │   ├── icon.ico           ← Windows 아이콘 (필수)
    │   └── icon.png           ← 앱 아이콘 (필수)
    ├── standalone/            ← 빌드 후 자동 생성
    ├── forge.config.js
    └── package.json
```

---

## 빌드 전 체크리스트

- [ ] Node.js 18+ 설치
- [ ] `ptzcontroller_admin/` 폴더가 **상위 디렉토리**에 있는지 확인
- [ ] `ptzcontroller_admin/.env` 에 `DATABASE_URL`, `NEXTAUTH_SECRET` 설정
- [ ] `assets/icon.ico`, `assets/icon.png` 파일 배치 (256×256 이상)

---

## 빌드 순서 (총정리)

### Step 1: 먼저 바탕이되는 ptzcontroller_admin 빌드

이미 빌드시 생략

```bash
cd ../ptzcontroller_admin
yarn install        # 최초 1회
yarn build          # prisma generate + next build
```

빌드 완료 후 `ptzcontroller_admin/.next/standalone/` 폴더가 생성되어야 합니다.

> **재빌드 시 (의존성 변경 없을 때):**
>
> ```bash
> yarn rebuild    # next build만 실행 (빠름)
> ```

### Step 2: standalone 복사

```bash
cd ../ptzcontroller_desktop
npm install         # 최초 1회
npm run copy:standalone
```

이 스크립트는 다음을 수행합니다:

| 단계  | 내용                                   |
| ----- | -------------------------------------- |
| [1/6] | `standalone/` 복사                     |
| [2/6] | `.next/static/` 복사                   |
| [3/6] | `public/` 복사                         |
| [4/6] | `data/` 복사                           |
| [5/6] | `.env` 복사 + `NEXTAUTH_URL` 자동 추가 |
| [6/6] | Prisma 엔진 바이너리 강제 복사         |

완료 후 `ptzcontroller_desktop/standalone/` 폴더를 확인하세요.

### Step 3: 개발 모드 테스트 (권장)

```bash
npm start
```

Electron 창이 열리고 PTZ Controller가 정상 로드되면 OK.

### Step 4: (선택) Node.js 포터블 번들

설치 대상 PC에 Node.js가 없을 경우 Node.js를 함께 번들합니다.

```bash
node scripts/bundle-node.js
```

완료 후 `node-bin/` 폴더 생성. 그 다음 `forge.config.js`의 `extraResource`에 추가:

```javascript
extraResource: [
    "./standalone",
    "./node-bin",   // ← 추가
],
```

> `electron/main.js`의 `getNodeExecutable()` 함수가 이미 `process.resourcesPath/node-bin/node.exe`를 우선 탐색하도록 구현되어 있습니다.

### Step 5: EXE 빌드

```bash
# Windows Squirrel 설치 파일 + ZIP
npm run make:win

# macOS
npm run make:mac

# Linux
npm run make:linux
```

---

## 빌드 결과물

```
out/
├── make/
│   ├── squirrel.windows/x64/
│   │   └── PTZControllerSetup.exe   ← 설치 파일 (시작 메뉴 등록)
│   └── zip/win32/x64/
│       └── ptzcontroller_admin-win32-x64.zip  ← 무설치 포터블
```

---

## forge.config.js 주요 설정

```javascript
module.exports = {
    packagerConfig: {
        // asar.unpackDir: standalone과 Prisma 바이너리는 asar 밖으로
        asar: {
            unpackDir: "{standalone,node_modules/.prisma,node_modules/@prisma}",
        },
        name: "ptzcontroller_admin",
        executableName: "ptzcontroller_admin",
        icon: "./assets/icon",
        extraResource: ["./standalone"], // standalone을 resources에 복사
        ignore: [/^\/standalone/], // asar 패키지에서 제외 (중복 방지)
    },
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: { name: "PTZController" },
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin", "linux", "win32"],
        },
    ],
};
```

---

## electron/main.js 동작 원리

### 앱 경로 계산

```javascript
function getAppPath() {
    if (app.isPackaged) {
        // 패키징 후: extraResource로 복사된 resources/standalone/
        return path.join(process.resourcesPath, "standalone");
    }
    // 개발 모드: 프로젝트 루트 standalone/
    return path.join(__dirname, "..", "standalone");
}
```

### Node 실행 파일 탐색

```javascript
function getNodeExecutable() {
    if (app.isPackaged) {
        const bundled = path.join(
            process.resourcesPath,
            "node-bin",
            process.platform === "win32" ? "node.exe" : "node",
        );
        if (fs.existsSync(bundled)) return bundled;
    }
    return process.platform === "win32" ? "node.exe" : "node";
}
```

### Prisma 엔진 경로 (플랫폼별 자동 선택)

```javascript
const platformEngineMap = {
  win32:  ['query_engine-windows.dll.node'],
  darwin: ['libquery_engine-darwin-arm64.dylib.node', ...],
  linux:  ['libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node', ...],
};
```

### 환경변수 주입

```javascript
const serverEnv = {
    ...process.env,
    ...envVars, // .env 파일 값
    PORT: String(PORT),
    HOSTNAME: "localhost",
    NODE_ENV: "production",
    NEXTAUTH_URL: envVars.NEXTAUTH_URL || `http://localhost:${PORT}`,
    PRISMA_QUERY_ENGINE_LIBRARY: engineFullPath,
};
```

---

## 자주 발생하는 문제 해결

### ❌ "server.js not found"

**원인:** `npm run copy:standalone`을 하지 않았거나 Next.js 빌드가 안 된 경우  
**해결:** Step 1, 2 다시 실행

---

### ❌ "Failed to start server: node not found" (패키징 후)

**원인:** 패키징된 EXE 환경에 Node.js가 없음  
**해결 A (권장):** `node scripts/bundle-node.js` → `forge.config.js` extraResource에 `./node-bin` 추가  
**해결 B:** 설치 대상 PC에 Node.js 설치 안내

---

### ❌ DATABASE_URL 관련 에러 / 로그인 실패

**원인:** `.env` 파일이 standalone에 복사되지 않았거나 `NEXTAUTH_URL` 누락  
**해결:** `npm run copy:standalone` 재실행  
(`.env` 자동 복사 + `NEXTAUTH_URL=http://localhost:3000` 자동 추가)

---

### ❌ Prisma "Unable to require / engine not found"

**원인 1:** `asar: true` 설정 시 native 바이너리가 asar 안에 묶임  
→ `forge.config.js`의 `asar.unpackDir`에 prisma 경로 포함 (이미 설정됨)

**원인 2:** `schema.prisma`의 `binaryTargets`에 `"windows"` 누락  
→ `prisma/schema.prisma` 확인:

```prisma
binaryTargets = ["native", "windows", "linux-musl-arm64-openssl-3.0.x"]
```

추가 후 `yarn prisma generate` 및 `yarn build` 재실행

**원인 3:** `copy-standalone.js`의 [6/6] 단계에서 엔진 파일 복사 실패  
→ `npm run copy:standalone` 재실행 후 로그에서 `✔ query_engine-windows.dll.node` 확인

---

### ❌ Squirrel maker 빌드 에러

**원인:** 이전 버전에서 `iconUrl`에 접근 불가능한 URL 설정  
**해결:** `forge.config.js`에서 `iconUrl` 항목 제거 (현재 소스에서는 이미 제거됨)

---

## 환경변수 (.env) 관리

`.env` 파일은 `npm run copy:standalone` 실행 시 `standalone/.env`로 자동 복사됩니다.  
`DATABASE_URL`이 외부 PostgreSQL(Neon 등)을 가리키므로 배포 환경에서 DB 접근이 가능해야 합니다.

**오프라인 환경에서 사용하려면:** SQLite로 전환하거나 로컬 PostgreSQL을 함께 배포하세요.

---

## ONVIF 카메라 지원 (electron/main.js)

`ptzcontroller_desktop/electron/main.js`에는 ONVIF SOAP 통신이 내장되어 있습니다.

### 인증 자동 협상

| 시도 순서 | 인증 방식 | 대상 카메라 |
|-----------|-----------|-------------|
| 1차 | 인증 없음 (plain) | 인증 불필요 카메라 |
| 2차 | HTTP Digest Auth | 삼성 iPolis, 한화비전 |
| 3차 | HTTP Basic Auth | 일부 저가 IP 카메라 |

### Profile Token 자동 조회

카메라 연결 시 `profileToken`이 비어 있으면 `GetProfiles`로 자동 조회합니다. (5분 캐시)

### 토큰 인증 중 메시지 버퍼링

WebSocket 연결 시 토큰 검증(HTTP 요청) 동안 도착하는 메시지를 버퍼에 저장하고,
인증 완료 후 순서대로 처리합니다. (`connect` 메시지 유실 방지)

### 주의: ptz-proxy-electron과의 차이

`ptzcontroller_desktop/electron/main.js`는 **데스크톱 앱 전용** 내장 proxy입니다.
별도 ptz-proxy-electron 없이 Electron 앱 자체에서 WebSocket 서버를 구동합니다.
