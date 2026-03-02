# PTZ Proxy 설치 및 사용 가이드

## 목차

1. [개요](#개요)
2. [동작 원리](#동작-원리)
3. [ptz-proxy-electron (권장)](#ptz-proxy-electron-권장)
4. [ptz-proxy 소스 실행 (고급)](#ptz-proxy-소스-실행-고급)
5. [웹앱에서 Proxy 모드 설정](#웹앱에서-proxy-모드-설정)
6. [WebSocket API](#websocket-api)
7. [문제 해결](#문제-해결)

---

## 개요

PTZ Proxy는 브라우저(또는 Electron 앱)가 Private 네트워크의 PTZ 카메라를 제어할 수 있도록  
WebSocket ↔ TCP를 중계하는 서비스입니다.

### 사용 시나리오

- PTZ 카메라가 Private 네트워크(로컬 LAN)에 있을 때
- 웹 서버(클라우드)에서 카메라에 직접 접근할 수 없을 때
- 사용자 PC에서만 카메라에 접근 가능할 때

### 제공 형태 2가지

| 형태 | 설명 | 권장 |
|------|------|------|
| **ptz-proxy-electron** | GUI + 시스템 트레이 앱 (Windows EXE) | ✅ 권장 |
| **ptz-proxy 소스** | Node.js CLI 방식, ZIP 다운로드 | 고급 사용자 |

---

## 동작 원리

```
┌─────────────────────────────────────────────────────────┐
│                        Internet                         │
│  ┌──────────────┐                 ┌──────────────────┐  │
│  │  Web Server  │◄──── HTTPS ─────│     Browser      │  │
│  │  (Cloud)     │                 │   (User's PC)    │  │
│  └──────────────┘                 └────────┬─────────┘  │
│                                            │            │
│                                       WebSocket         │
│                                            │            │
│                                   ┌────────▼─────────┐  │
│                                   │  ptz-proxy-      │  │
│                                   │  electron        │  │
│                                   │  (User's PC)     │  │
│                                   └────────┬─────────┘  │
└────────────────────────────────────────────│────────────┘
                                             │ TCP
                              ┌──────────────▼──────────┐
                              │     Local Network        │
                              │   ┌──────────────┐       │
                              │   │  PTZ Camera  │       │
                              │   │ 192.168.x.x  │       │
                              │   └──────────────┘       │
                              └─────────────────────────-┘
```

### 통신 흐름

1. 브라우저가 PTZ Proxy에 WebSocket 연결 (`ws://[PC IP]:9902`)
2. 웹앱에서 PTZ 명령 전송 (JSON)
3. Proxy가 명령을 PelcoD 패킷으로 변환
4. TCP 소켓으로 카메라에 전송

---

## ptz-proxy-electron (권장)

### 특징

| 기능 | 설명 |
|------|------|
| 🖥 GUI 메인 창 | 서버 상태, 클라이언트 수, 실시간 로그 표시 |
| 🔔 시스템 트레이 | 창 닫아도 트레이에서 계속 실행 |
| 🚀 트레이 시작 모드 | 앱 실행 시 창 없이 트레이만 표시 |
| ⚙️ 포트 변경 | 앱 내에서 포트 번호 실시간 변경 |
| 📝 실시간 로그 | 접속·명령·오류 색상 구분 (최대 200줄) |

### 다운로드

**방법 1**: 웹앱에서 Proxy 연결 실패 시 자동으로 팝업 표시 → 다운로드 링크 클릭  
**방법 2**: 관리자가 업로드한 파일 직접 다운로드 (관리자 Proxy 파일 탭 참조)

### 빌드 방법 (소스에서 직접)

**요구사항**: Node.js 18+

```
ptz-proxy-electron/
├── main.js          ← Electron 메인 프로세스 (WebSocket 서버 포함)
├── index.html       ← GUI 화면
├── assets/
│   ├── icon.ico     ← 아이콘 (필수, 256×256 이상)
│   └── icon.png
└── package.json     ← electron-builder 설정
```

**아이콘 준비** (필수):
```
assets/ 폴더에 icon.ico, icon.png 파일을 배치
크기: 256×256 이상
```

**Windows EXE 빌드**:
```bat
build-electron.bat   ← 더블클릭
```

또는 수동:
```bash
npm install
npm run build        # electron-builder --win --x64
```

**빌드 결과물** (`dist/` 폴더):

| 파일 | 설명 |
|------|------|
| `PTZ Proxy Setup 1.0.1.exe` | 설치 프로그램 (시작 메뉴·바탕화면 등록) |
| `PTZ-Proxy-Portable-1.0.1.exe` | Portable — 설치 없이 바로 실행 |

### 트레이 아이콘 사용법

| 동작 | 결과 |
|------|------|
| 창의 ✕ 또는 ⊟ 클릭 | 트레이로 최소화 (서버 계속 실행) |
| 트레이 아이콘 클릭 | 창 열기 |
| 트레이 우클릭 | 서버 시작/중지, 종료 메뉴 |
| 트레이 메뉴 "종료" | 서버 중지 후 완전 종료 |

### 시작 시 트레이 모드

앱의 **"시작 시 트레이로 실행"** 토글을 ON 하면,  
다음 실행부터 창 없이 트레이 아이콘만 표시됩니다.  
설정은 자동 저장되며, 트레이 아이콘 클릭으로 창을 열 수 있습니다.

설정 파일 위치: `%AppData%\ptz-proxy\config.json`

---

## ptz-proxy 소스 실행 (고급)

웹앱의 Proxy 연결 실패 팝업에서 **"소스 코드 (ZIP)"** 다운로드 시 제공되는 방식입니다.

### 다운로드되는 ZIP 내용

| 파일 | 설명 |
|------|------|
| `ptz-proxy.js` | 핵심 proxy 서버 소스 (Node.js) |
| `package.json` | 의존성 (`ws` 패키지) |
| `start.bat` | Windows 실행 스크립트 |
| `start.sh` | Linux/Mac 실행 스크립트 |
| `build-exe.bat` | Windows EXE 빌드 스크립트 |
| `build-exe.sh` | Linux/Mac EXE 빌드 스크립트 |
| `README.md` | 사용 안내 |

### 실행 방법

```bash
# 압축 해제 후
cd ptz-proxy-standalone

npm install

# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh

# 포트 지정
node ptz-proxy.js 8765
```

기본 포트: **9902**

### EXE로 빌드 (pkg 사용)

```bat
build-exe.bat
```

또는 수동:

```bash
npm install
npm install -g pkg

# Windows EXE
npx pkg ptz-proxy.js --targets node18-win-x64 --output dist/ptz-proxy.exe

# Linux
npx pkg ptz-proxy.js --targets node18-linux-x64 --output dist/ptz-proxy-linux
```

---

## 웹앱에서 Proxy 모드 설정

### 카메라 설정

1. 카메라 추가 시 **Operation Mode** → **"Proxy"** 선택
2. **Proxy WebSocket URL** 입력:

| 상황 | URL |
|------|-----|
| 같은 PC에서 실행 중 | `ws://localhost:9902` |
| 다른 PC에서 실행 중 | `ws://192.168.1.100:9902` (Proxy PC의 IP) |

### 연결 실패 시 자동 팝업

Proxy 연결이 5초 내 실패하면 자동으로 다운로드 안내 팝업이 표시됩니다.

- 관리자가 업로드한 파일 있음 → 해당 파일 링크 우선 표시
- 업로드 파일 없음 → 소스 ZIP / GitHub 링크 표시

### 관리자 Proxy 파일 업로드

관리자 계정으로 로그인 → 🛡️ 버튼 → **"Proxy 파일"** 탭

1. `ptz-proxy-setup.exe` 등 빌드된 파일 업로드
2. 파일은 `public/downloads/` 에 저장
3. 이후 사용자 팝업에 자동으로 다운로드 링크 표시

---

## WebSocket API

서버 주소: `ws://[호스트IP]:9902`

### 카메라 TCP 연결

```json
{
    "type": "connect",
    "config": {
        "host": "192.168.1.100",
        "port": 4001,
        "protocol": "pelcod",
        "address": 1
    }
}
```

### PTZ 명령

```json
{
    "type": "command",
    "command": {
        "action": "pan",
        "direction": "left",
        "speed": 50
    }
}
```

**지원 action:**

| action | direction | 설명 |
|--------|-----------|------|
| `pan` | `left` / `right` | 좌우 회전 |
| `tilt` | `up` / `down` | 상하 회전 |
| `zoom` | `in` / `out` | 줌 |
| `focus` | `near` / `far` | 초점 |
| `preset` | `goto` / `set` | 프리셋 이동/저장 |
| `stop` | — | 정지 |

### Raw 패킷 직접 전송

```json
{
    "type": "raw",
    "packet": [255, 1, 0, 4, 32, 0, 37]
}
```

### 연결 해제 / 상태 확인

```json
{ "type": "disconnect" }
{ "type": "ping" }
```

### 서버 응답 타입

| type | 설명 |
|------|------|
| `welcome` | 최초 연결 시 서버 정보 |
| `connected` | 카메라 TCP 연결 성공 |
| `command_sent` | PTZ 명령 전송 완료 + packet |
| `raw_sent` | Raw 패킷 전송 완료 |
| `pong` | ping 응답 |
| `disconnected` | 연결 해제 완료 |
| `error` | 오류 메시지 |

---

## 문제 해결

### WebSocket 연결 실패

```
WebSocket connection to 'ws://localhost:9902' failed
```

1. ptz-proxy-electron이 실행 중인지 확인 (트레이 아이콘)
2. 포트 번호 확인 (기본: 9902)
3. 방화벽에서 9902 포트 허용 여부 확인
4. 다른 PC에서 접속 시 Proxy PC의 IP 주소 확인

### 카메라 TCP 연결 실패 (ECONNREFUSED)

1. 카메라 IP와 포트 확인
2. 카메라 전원 및 네트워크 연결 확인
3. 카메라와 Proxy PC가 같은 네트워크인지 확인
4. 방화벽 설정 확인

### HTTPS 환경에서 ws:// 차단 (혼합 콘텐츠)

브라우저가 HTTPS 페이지에서 `ws://` 연결을 차단할 수 있습니다.

- 해결: nginx 등으로 `wss://` (WebSocket Secure) 프록시 구성
- 또는: 브라우저 설정에서 해당 사이트의 혼합 콘텐츠 허용

### 카메라가 응답하지 않음

1. 프로토콜 설정 확인 (PelcoD / ujin)
2. 장치 주소(Address) 확인 (카메라 DIP 스위치)
3. Hex 모니터에서 TX 패킷 전송 여부 확인
4. 속도(speed) 값이 0이 아닌지 확인
