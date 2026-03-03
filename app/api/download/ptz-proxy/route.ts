import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import archiver from "archiver";

// ─────────────────────────────────────────────────────────────
// force-dynamic: request.url(searchParams)를 사용하는 라우트는
// 반드시 동적 렌더링으로 지정해야 함.
// 없으면 Next.js 빌드 시 static rendering을 시도하다 에러 발생:
//   "Dynamic server usage: couldn't be rendered statically"
// ─────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

// PTZ Proxy 파일 다운로드
// - ?type=list : 업로드된 파일 목록 반환 (JSON)
// - ?file=xxx  : public/downloads/xxx 파일 직접 다운로드
// - (기본)      : 업로드된 파일이 없으면 동적 ZIP 생성
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const fileParam = searchParams.get("file");
        const typeParam = searchParams.get("type");

        const downloadsDir = join(process.cwd(), "public", "downloads");

        // ?file=filename → 특정 파일 직접 다운로드
        if (fileParam) {
            const safeName = fileParam.replace(/[^a-zA-Z0-9._\-]/g, "_");
            const filePath = join(downloadsDir, safeName);
            if (!existsSync(filePath)) {
                return NextResponse.json(
                    { error: "File not found" },
                    { status: 404 },
                );
            }
            const buffer = readFileSync(filePath);
            const isExe =
                safeName.endsWith(".exe") || safeName.endsWith(".msi");
            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": isExe
                        ? "application/octet-stream"
                        : "application/zip",
                    "Content-Disposition": `attachment; filename="${safeName}"`,
                    "Content-Length": buffer.length.toString(),
                },
            });
        }

        // ?type=list → 업로드된 파일 목록만 반환
        if (typeParam === "list") {
            const files = existsSync(downloadsDir)
                ? readdirSync(downloadsDir).map((name: string) => {
                      const stat = statSync(join(downloadsDir, name));
                      return {
                          filename: name,
                          size: stat.size,
                          downloadUrl: `/downloads/${name}`,
                      };
                  })
                : [];
            return NextResponse.json({ files });
        }

        // 기본: 동적 ZIP 생성
        const files = {
            "ptz-proxy.js": getPtzProxySource(),
            "package.json": getPackageJson(),
            "start.bat": getStartBat(),
            "start.sh": getStartSh(),
            "build-exe.bat": getBuildExeBat(),
            "build-exe.sh": getBuildExeSh(),
            "README.md": getReadme(),
        };

        // ZIP 파일 생성
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.on("data", (chunk) => chunks.push(chunk));

        // 파일들 추가
        for (const [name, content] of Object.entries(files)) {
            archive.append(content, { name: `ptz-proxy-standalone/${name}` });
        }

        await archive.finalize();

        const buffer = Buffer.concat(chunks);

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition":
                    'attachment; filename="ptz-proxy-standalone.zip"',
                "Content-Length": buffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json(
            { error: "Failed to create download" },
            { status: 500 },
        );
    }
}

function getPtzProxySource(): string {
    return `/**
 * PTZ Proxy - Standalone WebSocket Server
 * 
 * 브라우저와 PTZ 카메라 사이의 프록시 역할을 하는 독립 실행 서버
 * WebSocket으로 명령을 받아 PelcoD/ujin 프로토콜로 변환하여 카메라에 전송
 * 
 * 사용법:
 *   node ptz-proxy.js [port]
 *   node ptz-proxy.js 9902
 */

const WebSocket = require('ws');
const net = require('net');

// ====================
// 설정
// ====================
// 변경점 1: 9902 포트의 권한/충돌 에러를 피하기 위해 기본 포트를 9902으로 변경
const DEFAULT_PORT = 9902;
const PORT = parseInt(process.argv[2]) || DEFAULT_PORT;

// ====================
// PelcoD 패킷 빌더
// ====================

/**
 * PelcoD 패킷 생성
 * 패킷 구조: [Sync, Address, Cmd1, Cmd2, Data1, Data2, Checksum]
 */
function buildPelcoDPacket(command, address = 1) {
  const addr = address & 0xFF;
  let cmd1 = 0x00;
  let cmd2 = 0x00;
  let data1 = 0x00;
  let data2 = 0x00;

  const speed = Math.min(0x3F, Math.max(0x00, Math.round((command.speed || 50) * 0x3F / 100)));

  switch (command.action) {
    case 'pan':
      data1 = speed;
      if (command.direction === 'left') {
        cmd2 = 0x04;
      } else if (command.direction === 'right') {
        cmd2 = 0x02;
      }
      break;

    case 'tilt':
      data2 = speed;
      if (command.direction === 'up') {
        cmd2 = 0x08;
      } else if (command.direction === 'down') {
        cmd2 = 0x10;
      }
      break;

    case 'zoom':
      if (command.direction === 'in') {
        cmd2 = 0x20;
      } else if (command.direction === 'out') {
        cmd2 = 0x40;
      }
      break;

    case 'focus':
      if (command.direction === 'near') {
        cmd2 = 0x01;
        cmd1 = 0x01;
      } else if (command.direction === 'far') {
        cmd2 = 0x00;
        cmd1 = 0x02;
      }
      break;

    case 'stop':
      cmd1 = 0x00;
      cmd2 = 0x00;
      data1 = 0x00;
      data2 = 0x00;
      break;

    case 'preset':
      if (command.direction === 'goto') {
        cmd1 = 0x00;
        cmd2 = 0x07;
        data2 = (command.presetNumber || 1) & 0xFF;
      } else if (command.direction === 'set') {
        cmd1 = 0x00;
        cmd2 = 0x03;
        data2 = (command.presetNumber || 1) & 0xFF;
      }
      break;

    default:
      console.warn('Unknown action:', command.action);
  }

  const checksum = (addr + cmd1 + cmd2 + data1 + data2) & 0xFF;
  return Buffer.from([0xFF, addr, cmd1, cmd2, data1, data2, checksum]);
}

function buildUjinPacket(command, address = 1) {
  return buildPelcoDPacket(command, address);
}

// ====================
// 연결 관리자
// ====================
class ConnectionManager {
  constructor() {
    this.connections = new Map();
  }

  async connect(wsId, config) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.connect(config.port, config.host, () => {
        clearTimeout(timeout);
        this.connections.set(wsId, { socket, config });
        console.log('[' + wsId + '] Connected to ' + config.host + ':' + config.port);
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[' + wsId + '] Socket error:', err.message);
        // 변경점 2: 네트워크 에러 발생 시 좀비 소켓이 남지 않도록 완전히 파괴(메모리 누수 방지)
        socket.destroy();
        reject(err);
      });

      socket.on('close', () => {
        console.log('[' + wsId + '] Socket closed');
        this.connections.delete(wsId);
      });

      socket.on('data', (data) => {
        console.log('[' + wsId + '] Received:', data.toString('hex'));
      });
    });
  }

  disconnect(wsId) {
    const conn = this.connections.get(wsId);
    if (conn) {
      conn.socket.destroy();
      this.connections.delete(wsId);
      console.log('[' + wsId + '] Disconnected');
    }
  }

  sendCommand(wsId, command) {
    const conn = this.connections.get(wsId);
    if (!conn) {
      throw new Error('Not connected');
    }

    let packet;
    const protocol = conn.config.protocol || 'pelcod';
    const address = conn.config.address || 1;

    if (protocol === 'ujin') {
      packet = buildUjinPacket(command, address);
    } else {
      packet = buildPelcoDPacket(command, address);
    }

    conn.socket.write(packet);
    console.log('[' + wsId + '] Sent ' + command.action + ':', packet.toString('hex'));
    return packet;
  }

  sendRaw(wsId, packetArray) {
    const conn = this.connections.get(wsId);
    if (!conn) {
      throw new Error('Not connected');
    }

    const packet = Buffer.from(packetArray);
    conn.socket.write(packet);
    console.log('[' + wsId + '] Sent raw:', packet.toString('hex'));
    return packet;
  }

  isConnected(wsId) {
    return this.connections.has(wsId);
  }

  disconnectAll() {
    for (const [wsId] of this.connections) {
      this.disconnect(wsId);
    }
  }
}

// ====================
// WebSocket 서버
// ====================
const connectionManager = new ConnectionManager();
let wsIdCounter = 0;

// 변경점 3: 외부 망(스마트폰, 다른 PC)에서도 접속 가능하도록 0.0.0.0 으로 바인딩
const wss = new WebSocket.Server({ 
  host: '0.0.0.0',
  port: PORT 
});

// 서버 시작 에러 핸들링
wss.on('error', (error) => {
  if (error.code === 'EACCES') {
    console.error('');
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ 포트 ' + PORT + ' 접근 권한 오류 (EACCES)                        ║');
    console.error('╠═══════════════════════════════════════════════════════════════╣');
    console.error('║  해결 방법:                                                    ║');
    console.error('║  1. 다른 포트 사용: node ptz-proxy.js 9902                     ║');
    console.error('║  2. 관리자 권한으로 실행 (CMD를 관리자로 열기)                  ║');
    console.error('║  3. 방화벽에서 포트 ' + PORT + ' 허용                                ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error('');
  } else if (error.code === 'EADDRINUSE') {
    console.error('');
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ 포트 ' + PORT + '가 이미 사용 중입니다 (EADDRINUSE)              ║');
    console.error('╠═══════════════════════════════════════════════════════════════╣');
    console.error('║  해결 방법:                                                    ║');
    console.error('║  1. 기존 ptz-proxy 프로세스 종료                               ║');
    console.error('║  2. 다른 포트 사용: node ptz-proxy.js 9902                     ║');
    console.error('║  3. Windows: netstat -ano | findstr :' + PORT + '                   ║');
    console.error('║     taskkill /PID <프로세스ID> /F                              ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error('');
  } else {
    console.error('WebSocket 서버 오류:', error);
  }
  process.exit(1);
});

wss.on('listening', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║         PTZ Proxy Server Started!             ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log('║  WebSocket URL: ws://0.0.0.0:' + PORT.toString().padEnd(17) + '║');
  console.log('║  Protocol: PelcoD / ujin                      ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log('║  Press Ctrl+C to stop                         ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
});

wss.on('connection', (ws, req) => {
  const wsId = 'client_' + (++wsIdCounter);
  const clientIp = req.socket.remoteAddress;
  console.log('[' + wsId + '] New connection from ' + clientIp);

  // 변경점 4: 소켓이 열려있을 때만 메시지를 전송하는 안전 함수(서버 크래시 방지)
  const safeSend = (payload) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[' + wsId + '] Received:', message.type);

      switch (message.type) {
        case 'connect':
          try {
            await connectionManager.connect(wsId, message.config);
            safeSend({
              type: 'connected',
              success: true,
              message: 'Connected to ' + message.config.host + ':' + message.config.port
            });
          } catch (err) {
            safeSend({
              type: 'error',
              success: false,
              message: 'Connection failed: ' + err.message
            });
          }
          break;

        case 'disconnect':
          connectionManager.disconnect(wsId);
          safeSend({ type: 'disconnected', success: true });
          break;

        case 'command':
          try {
            const packet = connectionManager.sendCommand(wsId, message.command);
            safeSend({
              type: 'command_sent',
              success: true,
              packet: Array.from(packet)
            });
          } catch (err) {
            safeSend({ type: 'error', success: false, message: err.message });
          }
          break;

        case 'raw':
          try {
            const packet = connectionManager.sendRaw(wsId, message.packet);
            safeSend({
              type: 'raw_sent',
              success: true,
              packet: Array.from(packet)
            });
          } catch (err) {
            safeSend({ type: 'error', success: false, message: err.message });
          }
          break;

        case 'ping':
          safeSend({ type: 'pong', connected: connectionManager.isConnected(wsId) });
          break;

        default:
          safeSend({ type: 'error', message: 'Unknown message type: ' + message.type });
      }
    } catch (err) {
      console.error('[' + wsId + '] Error parsing/handling message:', err.message);
      // JSON 파싱 에러 등 예기치 못한 에러 처리 시에도 safeSend 적용
      safeSend({ type: 'error', message: 'Invalid or unhandled error: ' + err.message });
    }
  });

  ws.on('close', () => {
    console.log('[' + wsId + '] Connection closed');
    connectionManager.disconnect(wsId);
  });

  ws.on('error', (err) => {
    console.error('[' + wsId + '] WebSocket error:', err.message);
  });

  // 초기 접속 시 환영 메시지도 안전하게 전송
  safeSend({
    type: 'welcome',
    message: 'PTZ Proxy Server',
    version: '1.0.1',
    protocols: ['pelcod', 'ujin']
  });
});

process.on('SIGINT', () => {
  console.log('\\nShutting down...');
  connectionManager.disconnectAll();
  wss.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\\nShutting down...');
  connectionManager.disconnectAll();
  wss.close(() => process.exit(0));
});
`;
}

function getPackageJson(): string {
    return `{
  "name": "ptz-proxy",
  "version": "1.0.1",
  "description": "PTZ Camera WebSocket Proxy Server",
  "main": "ptz-proxy.js",
  "scripts": {
    "start": "node ptz-proxy.js",
    "start:9902": "node ptz-proxy.js 9902",
    "start:9000": "node ptz-proxy.js 9000"
  },
  "keywords": ["ptz", "camera", "pelcod", "websocket", "proxy"],
  "author": "PTZ Controller Team",
  "license": "MIT",
  "dependencies": {
    "ws": "^8.19.0"
  }
}
`;
}

function getStartBat(): string {
    return `@echo off
echo ============================================
echo       PTZ Proxy Server Launcher
echo ============================================
echo.

cd /d %~dp0

REM Node.js 설치 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM node_modules 확인
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)

REM 포트 설정
set /p PORT="Enter port number (default: 9902): "
if "%PORT%"=="" set PORT=9902

echo.
echo Starting PTZ Proxy on port %PORT%...
echo.

node ptz-proxy.js %PORT%

pause
`;
}

function getStartSh(): string {
    return `#!/bin/bash
echo "============================================"
echo "       PTZ Proxy Server Launcher"
echo "============================================"
echo

cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo
fi

PORT=\${1:-9902}

echo
echo "Starting PTZ Proxy on port $PORT..."
echo

node ptz-proxy.js $PORT
`;
}

function getBuildExeBat(): string {
    return `@echo off
echo ============================================
echo       PTZ Proxy EXE Builder
echo ============================================
echo.

cd /d %~dp0

REM Node.js 설치 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM pkg 설치 확인 및 설치
echo Checking pkg installation...
call npm list -g pkg >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing pkg globally...
    call npm install -g pkg
)

REM node_modules 확인
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)

REM 빌드 디렉토리 생성
if not exist dist mkdir dist

echo.
echo Building Windows EXE...
call npx pkg ptz-proxy.js --targets node18-win-x64 --output dist/ptz-proxy.exe

if exist dist\\ptz-proxy.exe (
    echo.
    echo ============================================
    echo   Build Complete!
    echo ============================================
    echo.
    echo   Output: dist\\ptz-proxy.exe
    echo.
    echo   Usage: ptz-proxy.exe [port]
    echo   Example: ptz-proxy.exe 9902
    echo.
) else (
    echo.
    echo [ERROR] Build failed!
)

pause
`;
}

function getBuildExeSh(): string {
    return `#!/bin/bash
echo "============================================"
echo "       PTZ Proxy EXE Builder"
echo "============================================"
echo

cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

if ! command -v pkg &> /dev/null; then
    echo "Installing pkg globally..."
    npm install -g pkg
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo
fi

mkdir -p dist

echo
echo "Building binaries..."
echo

echo "Building Windows EXE..."
npx pkg ptz-proxy.js --targets node18-win-x64 --output dist/ptz-proxy-win.exe

echo "Building Linux binary..."
npx pkg ptz-proxy.js --targets node18-linux-x64 --output dist/ptz-proxy-linux

echo "Building macOS binary..."
npx pkg ptz-proxy.js --targets node18-macos-x64 --output dist/ptz-proxy-macos

echo
echo "============================================"
echo "   Build Complete!"
echo "============================================"
echo
echo "   Output directory: dist/"
echo
ls -la dist/
echo
`;
}

function getReadme(): string {
    return `# PTZ Proxy - Standalone Server v1.0.1

PTZ 카메라를 원격으로 제어하기 위한 WebSocket 프록시 서버

## 설치

\`\`\`bash
npm install
\`\`\`

## 실행

### Windows
\`\`\`bash
start.bat
\`\`\`

### Linux/Mac
\`\`\`bash
chmod +x start.sh
./start.sh
\`\`\`

### 직접 실행
\`\`\`bash
node ptz-proxy.js [port]
node ptz-proxy.js 9902
\`\`\`

## EXE 빌드 (인스톨러)

Node.js가 없는 PC에서도 실행할 수 있도록 EXE 파일로 빌드합니다.

### Windows
\`\`\`batch
build-exe.bat
\`\`\`

### Linux/Mac
\`\`\`bash
chmod +x build-exe.sh
./build-exe.sh
\`\`\`

빌드 결과물은 dist/ 폴더에 생성됩니다.

## 지원 프로토콜

| action | direction | 설명 |
|--------|-----------|------|
| pan | left, right | 좌우 회전 |
| tilt | up, down | 상하 회전 |
| zoom | in, out | 줌인/아웃 |
| focus | near, far | 포커스 |
| stop | - | 정지 |
| preset | goto, set | 프리셋 |
`;
}
