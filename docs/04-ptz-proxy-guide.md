# PTZ Proxy 설치 및 사용 가이드

## 목차

1. [개요](#개요)
2. [동작 원리](#동작-원리)
3. [설치 방법](#설치-방법)
4. [실행 방법](#실행-방법)
5. [설정](#설정)
6. [독립 배포판 만들기](#독립-배포판-만들기)
7. [문제 해결](#문제-해결)

---

## 개요

PTZ Proxy는 브라우저에서 직접 PTZ 카메라를 제어할 수 있게 해주는 WebSocket 기반 프록시 서비스입니다.

### 사용 시나리오

- PTZ 카메라가 Private 네트워크에 있을 때
- 웹 서버에서 카메라에 직접 접근할 수 없을 때
- 사용자 PC에서만 카메라에 접근 가능할 때

---

## 동작 원리

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
│  ┌──────────────┐                    ┌──────────────────┐       │
│  │  Web Server  │◄──── HTTPS ────────│     Browser      │       │
│  │   (Cloud)    │                    │   (User's PC)    │       │
│  └──────────────┘                    └────────┬─────────┘       │
│                                               │                 │
│                                          WebSocket              │
│                                               │                 │
│                                               ▼                 │
│                                      ┌──────────────────┐       │
│                                      │    PTZ Proxy     │       │
│                                      │   (User's PC)    │       │
│                                      └────────┬─────────┘       │
└───────────────────────────────────────────────│─────────────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              │     Local Network                 │
                              │                 │                 │
                              │                 ▼                 │
                              │        ┌──────────────┐           │
                              │        │ PTZ Camera   │           │
                              │        │ (192.168.x.x)│           │
                              │        └──────────────┘           │
                              └───────────────────────────────────┘
```

### 통신 흐름

1. 브라우저가 PTZ Proxy에 WebSocket 연결
2. 웹 앱에서 PTZ 명령 전송
3. PTZ Proxy가 명령을 PelcoD/ujin 패킷으로 변환
4. TCP 소켓으로 카메라에 전송

---

## 설치 방법

### 방법 1: 프로젝트에서 직접 실행

```bash
# 프로젝트 디렉토리에서
cd projectdir/ptzcontroller_admin

# 의존성 설치 (최초 1회)
yarn install

# PTZ Proxy 실행
npx tsx ptz-proxy-standalone.ts
```

### 방법 2: 독립 실행 파일 사용

```bash
# 별도 폴더에 PTZ Proxy만 설치
mkdir ptz-proxy
cd ptz-proxy

# package.json 생성
npm init -y

# 의존성 설치
npm install ws typescript tsx

# ptz-proxy-standalone.ts 복사
cp /path/to/ptz-proxy-standalone.ts .

# 실행
npx tsx ptz-proxy-standalone.ts
```

---

## 실행 방법

### 기본 실행

```bash
npx tsx ptz-proxy-standalone.ts
```

기본 포트: **9902**

### 포트 지정

```bash
# 포트 9000으로 실행
npx tsx ptz-proxy-standalone.ts 9000
```

### 백그라운드 실행 (Linux/Mac)

```bash
# nohup으로 백그라운드 실행
nohup npx tsx ptz-proxy-standalone.ts &

# 로그 확인
tail -f nohup.out

# 프로세스 종료
pkill -f ptz-proxy-standalone
```

### Windows 서비스로 실행

```batch
@echo off
REM start-proxy.bat
cd /d %~dp0
node ptz-proxy.js 9902
```

---

## 설정

### 웹 앱에서 Proxy 모드 설정

1. 카메라 추가 시 **Operation Mode**를 "Proxy"로 선택
2. **Proxy WebSocket URL** 입력:
    - 같은 PC: `ws://localhost:9902`
    - 다른 PC: `ws://192.168.1.100:9902` (Proxy PC의 IP)

### 카메라 연결 설정

Proxy 연결 후 카메라 설정을 WebSocket으로 전송:

```json
{
    "type": "connect",
    "config": {
        "host": "192.168.1.200",
        "port": 5000,
        "protocol": "pelcod",
        "address": 1
    }
}
```

### 지원 프로토콜

| 프로토콜 | 설명                         |
| -------- | ---------------------------- |
| pelcod   | 표준 PelcoD 프로토콜         |
| ujin     | PelcoD 변형 (확장 명령 포함) |

---

## 독립 배포판 만들기

### 파일 구조

```
ptz-proxy-standalone/
├── node_modules/        # 의존성
├── ptz-proxy.js         # 컴파일된 JavaScript
├── package.json
├── start.bat            # Windows 실행
└── start.sh             # Linux/Mac 실행
```

### TypeScript 컴파일

```bash
# TypeScript 컴파일
npx tsc ptz-proxy-standalone.ts --outDir dist --module commonjs --target ES2020 --esModuleInterop true --moduleResolution node
```

### package.json (독립 배포용)

```json
{
    "name": "ptz-proxy",
    "version": "1.0.0",
    "main": "ptz-proxy.js",
    "scripts": {
        "start": "node ptz-proxy.js"
    },
    "dependencies": {
        "ws": "^8.19.0"
    }
}
```

### Windows 실행 스크립트

```batch
@echo off
REM start.bat
cd /d %~dp0
node ptz-proxy.js %1
pause
```

### Linux/Mac 실행 스크립트

```bash
#!/bin/bash
# start.sh
cd "$(dirname "$0")"
node ptz-proxy.js "$1"
```

### 배포 명령

```bash
# 1. 배포 폴더 생성
mkdir -p dist/ptz-proxy

# 2. 파일 복사
cp ptz-proxy-standalone.ts dist/ptz-proxy/
cp package.json dist/ptz-proxy/

# 3. 의존성 설치
cd dist/ptz-proxy
npm install --production

# 4. 컴파일 (옵션)
npx tsc ptz-proxy-standalone.ts --outFile ptz-proxy.js

# 5. 압축
cd ..
zip -r ptz-proxy.zip ptz-proxy/
```

---

## PTZ Proxy 소스 코드 구조

### 주요 함수

```typescript
// WebSocket 서버 시작
const wss = new WebSocketServer({ port: PORT });

// 클라이언트 연결 처리
wss.on("connection", (ws) => {
    // ...
});

// PTZ 명령 처리
function handleCommand(
    command: PTZCommand,
    socket: net.Socket,
    address: number,
) {
    const packet = buildPelcoDPacket(command, address);
    socket.write(Buffer.from(packet));
}

// PelcoD 패킷 생성
function buildPelcoDPacket(command: PTZCommand, address: number): number[] {
    // 8바이트 PelcoD 패킷 생성
    // [0xFF, Address, Cmd1, Cmd2, Data1, Data2, Checksum]
}
```

### 메시지 프로토콜

**연결 요청:**

```json
{
    "type": "connect",
    "config": {
        "host": "192.168.1.200",
        "port": 5000,
        "protocol": "pelcod",
        "address": 1
    }
}
```

**PTZ 명령:**

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

**Raw 패킷 (직접 전송):**

```json
{
    "type": "raw",
    "packet": [255, 1, 0, 4, 32, 0, 37]
}
```

---

## 문제 해결

### 연결 실패: ECONNREFUSED

```
Error: connect ECONNREFUSED 192.168.1.200:5000
```

**해결:**

- 카메라 IP와 포트 확인
- 카메라 전원 및 네트워크 연결 확인
- 방화벽 설정 확인

### WebSocket 연결 실패

```
WebSocket connection to 'ws://localhost:9902' failed
```

**해결:**

- PTZ Proxy가 실행 중인지 확인
- 포트 번호 확인
- 방화벽에서 해당 포트 허용

### 브라우저 보안 경고

혼합 콘텐츠(HTTPS + WS) 경고 시:

**해결:**

- 로컬에서는 `ws://` 사용 가능
- 외부 접속 시 WSS(WebSocket Secure) 필요
- nginx 등으로 SSL 터미널 구성

### 카메라가 응답하지 않음

**확인사항:**

1. 프로토콜 설정 확인 (PelcoD vs ujin)
2. 장치 주소(Address) 확인
3. 통신 속도(Baud Rate) 확인 (시리얼 연결 시)

---

## 보안 고려사항

### 로컬 네트워크 제한

```javascript
// 로컬 IP만 허용
wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    if (!ip.startsWith("192.168.") && ip !== "127.0.0.1") {
        ws.close();
        return;
    }
    // ...
});
```

### 인증 추가

```javascript
wss.on("connection", (ws, req) => {
    const token = req.headers["authorization"];
    if (token !== "Bearer YOUR_SECRET_TOKEN") {
        ws.close();
        return;
    }
    // ...
});
```
