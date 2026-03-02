# PTZ Controller 독립 실행 파일(EXE) 만들기

## 목차
1. [개요](#개요)
2. [방법 1: Node.js SEA (Single Executable Applications)](#방법-1-nodejs-sea-single-executable-applications)
3. [방법 2: pkg를 사용한 EXE 생성](#방법-2-pkg를-사용한-exe-생성)
4. [방법 3: nexe를 사용한 EXE 생성](#방법-3-nexe를-사용한-exe-생성)
5. [방법 4: Electron으로 데스크톱 앱 만들기](#방법-4-electron으로-데스크톱-앱-만들기)
6. [방법 5: 포터블 Node.js 배포](#방법-5-포터블-nodejs-배포)
7. [설치 파일 만들기](#설치-파일-만들기)

---

## 개요

Next.js 애플리케이션을 독립 실행 파일로 만드는 여러 방법이 있습니다.

| 방법 | 장점 | 단점 |
|------|------|------|
| **SEA** | Node.js 공식 기능, 단일 EXE | 실험적 기능, 외부 파일 필요 |
| pkg | 단일 EXE 파일 | Next.js 호환성 이슈 가능 |
| nexe | 경량, 빠름 | Next.js 직접 지원 X |
| Electron | 완전한 데스크톱 앱 | 파일 크기 큼 (100MB+) |
| 포터블 배포 | 가장 안정적 | 폴더 형태 배포 |

**권장**: 
- **단일 EXE 원할 시**: SEA 또는 pkg
- **안정성 우선**: **방법 5 (포터블 배포)** 또는 **방법 4 (Electron)**

---

## 방법 1: Node.js SEA (Single Executable Applications)

Node.js 20+ 에서 공식 지원하는 단일 실행 파일 생성 기능입니다.

### 요구사항

- Node.js 20.0.0 이상 (권장: 22+)
- Windows: Visual Studio Build Tools (선택)

### SEA 구조

```
[Node.js Binary] + [JavaScript Blob] = [Single EXE]
```

### 단계별 가이드

#### 1. Next.js Standalone 빌드

```bash
# next.config.js에 output: 'standalone' 설정 필요
cd nextjs_space
yarn build
```

#### 2. SEA용 진입점 파일 생성

```javascript
// sea-entry.js
const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// SEA에서 실행될 때 리소스 경로 설정
const isSeaBuild = require('node:sea').isSea();
const baseDir = isSeaBuild 
  ? path.dirname(process.execPath)
  : __dirname;

// Next.js standalone 서버 로드
const nextDir = path.join(baseDir, 'standalone');
process.chdir(nextDir);

// 환경 변수 설정
process.env.PORT = process.env.PORT || '3000';
process.env.HOSTNAME = 'localhost';

// standalone server.js 실행
require(path.join(nextDir, 'server.js'));

console.log(`
╔═══════════════════════════════════════════════╗
║         PTZ Controller Started!               ║
║   Open http://localhost:${process.env.PORT} in browser   ║
╚═══════════════════════════════════════════════╝
`);
```

#### 3. SEA 설정 파일 생성

```json
// sea-config.json
{
  "main": "sea-entry.js",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": true
}
```

#### 4. Blob 생성 및 EXE 빌드

```bash
# 1. JavaScript blob 생성
node --experimental-sea-config sea-config.json

# 2. Node.js 실행 파일 복사
cp $(which node) ptz-controller.exe  # Linux/Mac
copy "C:\Program Files\nodejs\node.exe" ptz-controller.exe  # Windows

# 3. 서명 제거 (Windows)
signtool remove /s ptz-controller.exe
# 또는 Postject 사용

# 4. Blob 주입
npx postject ptz-controller.exe NODE_SEA_BLOB sea-prep.blob ^
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# 5. (선택) 코드 서명
signtool sign /fd SHA256 ptz-controller.exe
```

### SEA 빌드 스크립트 (Windows)

```batch
@echo off
REM build-sea.bat

echo === Building PTZ Controller SEA ===

REM 1. Next.js 빌드
cd nextjs_space
call yarn build
cd ..

REM 2. 배포 폴더 준비
mkdir dist\sea 2>nul
xcopy /E /I /Y nextjs_space\.next\standalone dist\sea\standalone
xcopy /E /I /Y nextjs_space\.next\static dist\sea\standalone\.next\static
xcopy /E /I /Y nextjs_space\public dist\sea\standalone\public
xcopy /E /I /Y nextjs_space\data dist\sea\standalone\data

REM 3. SEA 진입점 복사
copy sea-entry.js dist\sea\
copy sea-config.json dist\sea\

REM 4. Blob 생성
cd dist\sea
node --experimental-sea-config sea-config.json

REM 5. Node.js 복사 및 주입
copy "%ProgramFiles%\nodejs\node.exe" ptz-controller.exe
npx postject ptz-controller.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo === Build Complete: dist\sea\ptz-controller.exe ===
cd ..\..
```

### SEA 제한사항 및 해결책

| 제한사항 | 해결책 |
|---------|--------|
| Native 모듈 미지원 | Pure JS 대안 사용 |
| 외부 파일 접근 필요 | standalone 폴더와 함께 배포 |
| 동적 require 제한 | 빌드 시점에 번들링 |
| 실험적 기능 | Node.js 22+에서 안정화 진행 중 |

### SEA + 외부 리소스 배포 구조

```
ptz-controller/
├── ptz-controller.exe     # SEA 실행 파일
├── standalone/            # Next.js standalone (필수)
│   ├── server.js
│   ├── .next/
│   ├── public/
│   └── data/
└── start.bat              # 간편 실행 스크립트
```

### start.bat (SEA용)

```batch
@echo off
cd /d %~dp0
start http://localhost:3000
ptz-controller.exe
pause
```

### SEA vs 다른 방법 비교

| 특성 | SEA | pkg | Electron |
|-----|-----|-----|----------|
| 공식 지원 | ✅ Node.js 공식 | ❌ 서드파티 | ❌ 서드파티 |
| 파일 크기 | ~50-80MB | ~80-100MB | ~150MB+ |
| Next.js 호환 | ⚠️ 외부 파일 필요 | ⚠️ 설정 복잡 | ✅ 우수 |
| 유지보수 | ✅ Node.js 팀 | ⚠️ 불확실 | ✅ 활발 |
| 성숙도 | ⚠️ 실험적 | ✅ 안정 | ✅ 안정 |

---

## 방법 2: pkg를 사용한 EXE 생성

### 설치

```bash
npm install -g pkg
```

### 커스텀 서버 생성

`server.js` 파일을 프로젝트 루트에 생성:

```javascript
// server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = false;
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// pkg에서 실행될 때 경로 설정
const dir = process.pkg ? path.dirname(process.execPath) : __dirname;

const app = next({ dev, hostname, port, dir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, () => {
    console.log(`> PTZ Controller ready on http://${hostname}:${port}`);
    console.log(`> Open your browser and navigate to the URL above`);
  });
});
```

### package.json 설정

```json
{
  "name": "ptz-controller",
  "bin": "server.js",
  "pkg": {
    "assets": [
      ".next/**/*",
      "public/**/*",
      "data/**/*",
      "node_modules/.prisma/**/*"
    ],
    "targets": [
      "node18-win-x64",
      "node18-linux-x64",
      "node18-macos-x64"
    ],
    "outputPath": "dist"
  }
}
```

### 빌드 및 패키징

```bash
# 1. Next.js 빌드
yarn build

# 2. EXE 생성
pkg . --output dist/ptz-controller.exe
```

---

## 방법 3: nexe를 사용한 EXE 생성

### 설치

```bash
npm install -g nexe
```

### standalone 빌드 후 패키징

```bash
# 1. standalone 빌드
yarn build

# 2. standalone 서버를 EXE로
cd .next/standalone
nexe server.js -o ptz-controller.exe
```

---

## 방법 4: Electron으로 데스크톱 앱 만들기

가장 안정적이고 완전한 데스크톱 경험을 제공합니다.

### 프로젝트 구조

```
ptz-controller-desktop/
├── electron/
│   ├── main.js          # Electron 메인 프로세스
│   └── preload.js       # 프리로드 스크립트
├── nextjs_space/        # Next.js 앱 (기존 코드)
├── package.json
└── forge.config.js      # Electron Forge 설정
```

### Electron 메인 프로세스

```javascript
// electron/main.js
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

const PORT = 3000;

function startServer() {
  const serverPath = path.join(__dirname, '..', 'nextjs_space', '.next', 'standalone', 'server.js');
  
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: PORT.toString() },
    cwd: path.join(__dirname, '..', 'nextjs_space', '.next', 'standalone')
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '..', 'nextjs_space', 'public', 'favicon.svg'),
    title: 'PTZ Controller'
  });

  // 서버 시작 후 약간의 지연
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }, 2000);

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### package.json (Electron 프로젝트)

```json
{
  "name": "ptz-controller-desktop",
  "version": "1.0.0",
  "description": "PTZ Camera Controller Desktop App",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build:next": "cd nextjs_space && yarn build",
    "package": "electron-forge package",
    "make": "electron-forge make"
  },
  "devDependencies": {
    "@electron-forge/cli": "^6.4.0",
    "@electron-forge/maker-squirrel": "^6.4.0",
    "@electron-forge/maker-zip": "^6.4.0",
    "electron": "^28.0.0"
  }
}
```

### Electron Forge 설정

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    asar: true,
    icon: './nextjs_space/public/favicon',
    name: 'PTZ Controller'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ptz_controller'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32']
    }
  ]
};
```

### 빌드 명령

```bash
# 1. Next.js 빌드
cd nextjs_space
yarn build

# 2. Electron 앱 패키징
cd ..
npm run package

# 3. 설치 파일 생성
npm run make
```

---

## 방법 5: 포터블 Node.js 배포

가장 안정적인 방법입니다.

### 배포 스크립트 (Windows)

```batch
@echo off
REM build-portable.bat

echo Building PTZ Controller...

REM 1. Next.js 빌드
cd nextjs_space
call yarn build
cd ..

REM 2. 배포 폴더 생성
set DIST_DIR=dist\ptz-controller-portable
mkdir %DIST_DIR%

REM 3. standalone 복사
xcopy /E /I nextjs_space\.next\standalone %DIST_DIR%\app
xcopy /E /I nextjs_space\.next\static %DIST_DIR%\app\.next\static
xcopy /E /I nextjs_space\public %DIST_DIR%\app\public
xcopy /E /I nextjs_space\data %DIST_DIR%\app\data

REM 4. Node.js 포터블 복사 (다운로드 필요)
REM https://nodejs.org/dist/에서 node-vXX.X.X-win-x64.zip 다운로드
xcopy /E /I node-v18.x.x-win-x64 %DIST_DIR%\node

REM 5. 실행 스크립트 생성
echo @echo off > %DIST_DIR%\start.bat
echo cd /d %%~dp0 >> %DIST_DIR%\start.bat
echo set PATH=%%~dp0node;%%PATH%% >> %DIST_DIR%\start.bat
echo cd app >> %DIST_DIR%\start.bat
echo node server.js >> %DIST_DIR%\start.bat
echo pause >> %DIST_DIR%\start.bat

echo Done! Distribution at %DIST_DIR%
```

### 실행 스크립트 (start.bat)

```batch
@echo off
cd /d %~dp0
set PATH=%~dp0node;%PATH%
cd app
set PORT=3000
start http://localhost:3000
node server.js
```

### 배포 폴더 구조

```
ptz-controller-portable/
├── node/                 # Node.js 포터블 버전
│   ├── node.exe
│   └── ...
├── app/                  # Next.js standalone
│   ├── server.js
│   ├── .next/
│   ├── public/
│   └── data/
├── start.bat             # Windows 실행 파일
└── start.sh              # Linux/Mac 실행 파일
```

---

## 설치 파일 만들기

### Inno Setup (Windows)

```ini
; ptz-controller.iss
[Setup]
AppName=PTZ Controller
AppVersion=1.0.0
DefaultDirName={autopf}\PTZ Controller
DefaultGroupName=PTZ Controller
OutputDir=installer
OutputBaseFilename=ptz-controller-setup

[Files]
Source: "dist\ptz-controller-portable\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\PTZ Controller"; Filename: "{app}\start.bat"
Name: "{commondesktop}\PTZ Controller"; Filename: "{app}\start.bat"

[Run]
Filename: "{app}\start.bat"; Description: "Launch PTZ Controller"; Flags: postinstall nowait
```

### NSIS (Windows 대안)

```nsis
; ptz-controller.nsi
Name "PTZ Controller"
OutFile "ptz-controller-installer.exe"
InstallDir "$PROGRAMFILES\PTZ Controller"

Section "Install"
  SetOutPath $INSTDIR
  File /r "dist\ptz-controller-portable\*.*"
  
  CreateShortCut "$DESKTOP\PTZ Controller.lnk" "$INSTDIR\start.bat"
  CreateDirectory "$SMPROGRAMS\PTZ Controller"
  CreateShortCut "$SMPROGRAMS\PTZ Controller\PTZ Controller.lnk" "$INSTDIR\start.bat"
SectionEnd
```

---

## 권장 워크플로우

```bash
# 1. Next.js 프로덕션 빌드
yarn build

# 2. 포터블 배포판 생성
./build-portable.bat   # Windows
./build-portable.sh    # Linux/Mac

# 3. 설치 파일 생성 (선택)
iscc ptz-controller.iss
```
