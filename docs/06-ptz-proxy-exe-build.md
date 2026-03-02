# PTZ Proxy EXE 빌드 가이드

PTZ Proxy를 독립 실행 파일(EXE)로 빌드하는 방법을 설명합니다.

## 개요

pkg를 사용하여 Node.js 애플리케이션을 단일 실행 파일로 패키징합니다.
이렇게 하면 Node.js가 설치되지 않은 PC에서도 PTZ Proxy를 실행할 수 있습니다.

## 사전 요구사항

- Node.js 18.x 이상
- npm 또는 yarn
- 인터넷 연결 (pkg 다운로드용)

## 빌드 방법

### 방법 1: 빌드 스크립트 사용 (권장)

#### Windows
```batch
cd ptz-proxy-standalone
build-exe.bat
```

#### Linux/Mac
```bash
cd ptz-proxy-standalone
chmod +x build-exe.sh
./build-exe.sh
```

### 방법 2: 수동 빌드

```bash
# 1. 의존성 설치
cd ptz-proxy-standalone
npm install

# 2. pkg 전역 설치
npm install -g pkg

# 3. Windows EXE 빌드
npx pkg ptz-proxy.js --targets node18-win-x64 --output dist/ptz-proxy.exe

# 4. Linux 빌드
npx pkg ptz-proxy.js --targets node18-linux-x64 --output dist/ptz-proxy-linux

# 5. macOS 빌드
npx pkg ptz-proxy.js --targets node18-macos-x64 --output dist/ptz-proxy-macos
```

### 방법 3: node 스크립트 사용

```bash
cd ptz-proxy-standalone
node build-installer.js
```

## 빌드 결과물

빌드가 완료되면 `dist/` 디렉토리에 실행 파일이 생성됩니다:

| 파일명 | 플랫폼 | 설명 |
|--------|--------|------|
| `ptz-proxy.exe` | Windows | Windows 64-bit 실행 파일 |
| `ptz-proxy-linux` | Linux | Linux 64-bit 바이너리 |
| `ptz-proxy-macos` | macOS | macOS 64-bit 바이너리 |

## EXE 사용법

### Windows
```batch
# 기본 포트 (9902)
ptz-proxy.exe

# 포트 지정
ptz-proxy.exe 8765
```

### Linux/Mac
```bash
# 실행 권한 부여
chmod +x ptz-proxy-linux

# 실행
./ptz-proxy-linux
./ptz-proxy-linux 8765
```

## 배포 방법

### 1. 직접 배포
생성된 EXE 파일을 USB나 네트워크를 통해 배포합니다.

### 2. Windows 인스톨러 생성 (선택사항)

Inno Setup을 사용하여 설치 프로그램을 만들 수 있습니다:

```iss
; ptz-proxy-setup.iss
[Setup]
AppName=PTZ Proxy
AppVersion=1.0.1
DefaultDirName={pf}\PTZ Proxy
DefaultGroupName=PTZ Proxy
OutputDir=installer
OutputBaseFilename=ptz-proxy-setup

[Files]
Source: "dist\ptz-proxy.exe"; DestDir: "{app}"

[Icons]
Name: "{group}\PTZ Proxy"; Filename: "{app}\ptz-proxy.exe"
Name: "{commondesktop}\PTZ Proxy"; Filename: "{app}\ptz-proxy.exe"

[Run]
Filename: "{app}\ptz-proxy.exe"; Description: "Launch PTZ Proxy"; Flags: postinstall nowait
```

Inno Setup 컴파일:
```batch
iscc ptz-proxy-setup.iss
```

## 방화벽 설정

Windows에서 EXE 실행 시 방화벽 경고가 나타날 수 있습니다.
"허용"을 클릭하여 네트워크 접근을 허용해야 합니다.

## 문제 해결

### 1. 빌드 실패
```bash
# pkg 캐시 삭제 후 재시도
npm cache clean --force
npm install -g pkg
```

### 2. 실행 시 오류
- **EACCES**: 관리자 권한으로 실행하거나 다른 포트 사용
- **EADDRINUSE**: 이미 사용 중인 포트, 다른 포트 지정

### 3. Windows Defender 경고
신뢰할 수 있는 소스임을 확인하고 "자세한 정보" → "실행" 클릭

## 파일 크기

pkg로 빌드된 EXE 파일은 Node.js 런타임을 포함하므로 약 **40-50MB** 크기입니다.
이는 정상적인 크기이며, 압축하면 약 15-20MB로 줄일 수 있습니다.
