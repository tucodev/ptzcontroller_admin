# PTZ Proxy 다운로드 파일 수정 가이드

## 현재 동작 구조

```
proxy 연결 실패
    ↓
ProxyDownloadModal 팝업 (components/proxy-download-modal.tsx)
    ↓
다운로드 버튼 클릭
    ↓
/api/download/ptz-proxy (app/api/download/ptz-proxy/route.ts)
    ↓
ZIP 파일 동적 생성하여 응답
    (ptz-proxy.js, package.json, start.bat, start.sh, build-exe.bat, README.md)
```

---

## 수정이 필요한 파일과 역할

### ① `app/api/download/ptz-proxy/route.ts` — 다운로드 ZIP 내용물 결정

다운로드되는 ZIP 안의 **모든 파일 내용이 이 파일 안에 문자열로 하드코딩**되어 있습니다.

| 함수 | ZIP 내 파일명 | 설명 |
|------|-------------|------|
| `getPtzProxySource()` | `ptz-proxy-standalone/ptz-proxy.js` | 핵심 proxy 서버 소스 |
| `getPackageJson()` | `ptz-proxy-standalone/package.json` | npm 의존성 |
| `getStartBat()` | `ptz-proxy-standalone/start.bat` | Windows 실행 스크립트 |
| `getStartSh()` | `ptz-proxy-standalone/start.sh` | Linux/Mac 실행 스크립트 |
| `getBuildExeBat()` | `ptz-proxy-standalone/build-exe.bat` | Windows EXE 빌드 스크립트 |
| `getBuildExeSh()` | `ptz-proxy-standalone/build-exe.sh` | Linux/Mac EXE 빌드 스크립트 |
| `getReadme()` | `ptz-proxy-standalone/README.md` | 사용 설명서 |

**ptz-proxy.js 내용을 수정하려면** → `getPtzProxySource()` 함수 본문을 수정

---

### ② `components/proxy-download-modal.tsx` — 팝업 UI와 다운로드 링크

```typescript
const downloadLinks = [
  {
    name: 'GitHub Releases',
    url: 'https://github.com/ptzcontroller_admin/ptz-proxy/releases/latest',  // ← GitHub URL 수정
    description: 'Latest stable release',
    icon: '📦'
  },
  {
    name: 'Direct Download (ZIP)',
    url: '/api/download/ptz-proxy',   // ← 서버에서 동적 생성하는 ZIP
    description: 'Download from this server',
    icon: '💾',
    isLocal: true
  }
];
```

**미리 준비한 EXE 파일을 직접 제공하려면** → url을 변경하거나 새 링크 추가

---

## 시나리오별 수정 방법

### 케이스 A: ptz-proxy.js 내용만 수정하고 싶을 때

`app/api/download/ptz-proxy/route.ts`의 `getPtzProxySource()` 함수 내부 문자열만 수정

```typescript
function getPtzProxySource(): string {
  return `
    // 여기 내용을 수정
    const WebSocket = require('ws');
    ...
  `;
}
```

---

### 케이스 B: 미리 빌드된 EXE 파일을 다운로드하게 하고 싶을 때

#### 방법 1: public 폴더에 파일 배치 (가장 간단)

```
public/
  downloads/
    ptz-proxy-win.exe      ← Windows EXE
    ptz-proxy-linux        ← Linux 바이너리
    ptz-proxy-standalone.zip  ← ZIP 파일
```

그 다음 `proxy-download-modal.tsx`의 downloadLinks 수정:

```typescript
const downloadLinks = [
  {
    name: 'Windows EXE (권장)',
    url: '/downloads/ptz-proxy-win.exe',   // public 폴더 내 경로
    description: 'Node.js 없이 바로 실행',
    icon: '🖥️',
    isLocal: true
  },
  {
    name: 'ZIP (소스)',
    url: '/api/download/ptz-proxy',
    description: 'Node.js 필요',
    icon: '💾',
    isLocal: true
  }
];
```

#### 방법 2: 외부 저장소 URL로 직접 연결

```typescript
{
  name: 'Windows EXE',
  url: 'https://github.com/your-org/ptz-proxy/releases/download/v1.0/ptz-proxy.exe',
  icon: '🖥️'
}
```

#### 방법 3: API route에서 파일시스템의 실제 파일 제공

`app/api/download/ptz-proxy/route.ts`를 수정하여
미리 빌드된 파일을 서버 파일시스템에서 읽어 제공:

```typescript
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'zip';

  if (type === 'exe') {
    // public/downloads/ptz-proxy.exe 파일을 직접 제공
    const filePath = join(process.cwd(), 'public', 'downloads', 'ptz-proxy.exe');
    const fileBuffer = readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="ptz-proxy.exe"',
      }
    });
  }

  // 기존 ZIP 동적 생성 로직
  ...
}
```

---

## EXE 파일 준비 방법

현재 ZIP 안에 `build-exe.bat`이 포함되어 있어서,
사용자가 ZIP을 받아서 직접 EXE를 빌드할 수 있도록 안내하고 있습니다.

**미리 빌드된 EXE를 첨부하려면:**

```bash
# ptz-proxy 소스 기준으로 EXE 빌드
cd ptz-proxy-standalone
npm install
npx pkg ptz-proxy.js --targets node18-win-x64 --output ptz-proxy.exe
```

생성된 `ptz-proxy.exe`를 `public/downloads/` 폴더에 배치하고
위의 방법 1 또는 방법 3으로 다운로드 링크 연결

---

## 수정 파일 요약

| 목적 | 수정 파일 |
|------|----------|
| proxy 소스 내용 변경 | `app/api/download/ptz-proxy/route.ts` |
| 다운로드 링크/UI 변경 | `components/proxy-download-modal.tsx` |
| EXE 파일 직접 제공 | `public/downloads/` 에 파일 배치 + 위 두 파일 수정 |
| 팝업 문구/안내 변경 | `components/proxy-download-modal.tsx` |
