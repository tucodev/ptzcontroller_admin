# PTZ Proxy EXE 빌드 가이드

PTZ Proxy를 독립 실행 파일(EXE)로 빌드하는 방법을 설명합니다.  
Node.js가 없는 PC에서도 바로 실행 가능한 배포 파일을 만들 수 있습니다.

---

## 방법 1: ptz-proxy-electron 빌드 (권장)

`ptz-proxy-electron/` 프로젝트를 electron-builder로 패키징합니다.  
GUI + 트레이 아이콘이 포함된 완성형 앱을 만듭니다.

### 사전 준비

- Node.js 18+
- `assets/icon.ico`, `assets/icon.png` 배치 (256×256 이상)

### 빌드 방법

**방법 A: 배치 파일 사용 (권장)**

```
build-electron.bat   ← 더블클릭
```

**방법 B: 수동**

```bash
cd ptz-proxy-electron
npm install
npm run build       # electron-builder --win --x64
```

### 빌드 결과물 (`dist/` 폴더)

| 파일 | 설명 |
|------|------|
| `PTZ Proxy Setup 1.0.1.exe` | 설치 프로그램 (시작 메뉴·바탕화면 등록) |
| `PTZ-Proxy-Portable-1.0.1.exe` | Portable — 설치 없이 바로 실행 |

### `package.json` 빌드 설정 요약

```json
{
  "build": {
    "appId": "com.ptz.proxy",
    "productName": "PTZ Proxy",
    "win": {
      "target": [
        { "target": "nsis",     "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "shortcutName": "PTZ Proxy"
    },
    "portable": {
      "artifactName": "PTZ-Proxy-Portable-${version}.exe"
    }
  }
}
```

---

## 방법 2: ptz-proxy 소스를 pkg로 EXE 빌드

웹앱 다운로드 팝업에서 받은 ZIP의 소스를 Node.js 없이 실행 가능한 단일 EXE로 빌드합니다.

### 사전 요구사항

- Node.js 18+ 및 npm

### ZIP 다운로드

웹앱에서 Proxy 연결 실패 팝업 → **"소스 코드 (ZIP)"** 다운로드  
또는: `/api/download/ptz-proxy` 직접 접근

### 빌드 방법

**방법 A: 빌드 스크립트 사용 (권장)**

```bat
cd ptz-proxy-standalone
build-exe.bat
```

또는 Linux/Mac:

```bash
cd ptz-proxy-standalone
chmod +x build-exe.sh
./build-exe.sh
```

**방법 B: 수동 빌드**

```bash
cd ptz-proxy-standalone

# 의존성 설치
npm install

# pkg 전역 설치
npm install -g pkg

# Windows EXE
npx pkg ptz-proxy.js --targets node18-win-x64 --output dist/ptz-proxy.exe

# Linux
npx pkg ptz-proxy.js --targets node18-linux-x64 --output dist/ptz-proxy-linux

# macOS
npx pkg ptz-proxy.js --targets node18-macos-x64 --output dist/ptz-proxy-macos
```

### 빌드 결과물 (`dist/` 폴더)

| 파일명 | 플랫폼 | 크기 |
|--------|--------|------|
| `ptz-proxy.exe` | Windows x64 | ~40–50 MB |
| `ptz-proxy-linux` | Linux x64 | ~40–50 MB |
| `ptz-proxy-macos` | macOS x64 | ~40–50 MB |

> Node.js 런타임이 내장되어 파일 크기가 큽니다. 압축 시 약 15–20 MB.

### EXE 사용법

```bat
# 기본 포트 (9902)
ptz-proxy.exe

# 포트 지정
ptz-proxy.exe 8765
```

Linux/Mac:

```bash
chmod +x ptz-proxy-linux
./ptz-proxy-linux
./ptz-proxy-linux 8765
```

---

## 빌드된 EXE를 웹앱 다운로드 팝업에 연결

빌드된 EXE를 관리자 페이지를 통해 사용자에게 배포합니다.

### 방법: 관리자 페이지 업로드

1. admin 계정으로 웹앱 로그인
2. 헤더의 🛡️ 버튼 클릭
3. **"Proxy 파일"** 탭 선택
4. 빌드된 파일 업로드 (`ptz-proxy-setup.exe` 등)
5. 이후 사용자 Proxy 연결 실패 팝업에 자동으로 다운로드 링크 표시

**업로드 가능 형식**: `.exe`, `.zip`, `.msi`, `.dmg`, `.sh`, `.bat`, `.appimage`  
**저장 위치**: `ptzcontroller_admin/public/downloads/`

---

## Windows 방화벽 설정

EXE 최초 실행 시 Windows 방화벽 경고가 나타납니다.

1. **"액세스 허용"** 클릭 (또는 "자세한 정보" → "실행")
2. 9902 포트를 인바운드 규칙에 허용

다른 PC에서 접속하려면 Windows 방화벽에서 9902 포트를 수동으로 허용해야 합니다:

```
Windows 방화벽 → 고급 설정 → 인바운드 규칙 → 새 규칙
→ 포트 → TCP → 9902 → 허용
```

---

## 문제 해결

### pkg 빌드 실패

```bash
npm cache clean --force
npm install -g pkg
```

### 실행 시 "포트 이미 사용 중" 오류 (EADDRINUSE)

```bat
ptz-proxy.exe 8765   # 다른 포트 사용
```

### 실행 시 "권한 없음" 오류 (EACCES)

관리자 권한으로 실행하거나 1024 이상의 포트 사용

### Windows Defender 경고 (서명 없음)

pkg로 빌드된 EXE는 코드 서명이 없어 Defender 경고가 발생할 수 있습니다.  
"자세한 정보" → "실행" 을 클릭하여 실행하세요.  
신뢰할 수 있는 내부 배포 환경에서만 사용하세요.

### ptz-proxy-electron 빌드 시 아이콘 오류

`assets/icon.ico` 또는 `assets/icon.png` 파일이 없거나 크기가 부족할 경우 발생합니다.  
256×256 이상의 PNG/ICO 파일을 `assets/` 폴더에 배치하세요.
