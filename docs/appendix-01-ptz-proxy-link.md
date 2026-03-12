# ptz-proxy 파일 첨부 방법

## 관리

admin 로그인 후 관리자 페이지(🛡️)의 **"Proxy 파일"** 탭에서 파일 업로드/관리가 가능합니다.

업로드된 파일은 `ptzcontroller_admin/public/downloads/` 에 저장되며,
사용자가 Proxy 연결 실패 시 표시되는 팝업에서 다운로드 링크로 자동 노출됩니다.

## 다운로드 ZIP 구조

`/api/download/ptz-proxy` 엔드포인트에서 동적으로 ZIP을 생성합니다.
ZIP 내 파일 내용은 `app/api/download/ptz-proxy/route.ts`에 하드코딩되어 있습니다.

| 함수 | ZIP 내 파일명 | 설명 |
|------|-------------|------|
| `getPtzProxySource()` | `ptz-proxy.js` | 핵심 proxy 서버 소스 |
| `getPackageJson()` | `package.json` | npm 의존성 |
| `getStartBat()` | `start.bat` | Windows 실행 스크립트 |
| `getStartSh()` | `start.sh` | Linux/Mac 실행 스크립트 |
| `getBuildExeBat()` | `build-exe.bat` | EXE 빌드 스크립트 |
| `getBuildExeSh()` | `build-exe.sh` | Linux/Mac EXE 빌드 스크립트 |
| `getReadme()` | `README.md` | 사용 안내 |

**ptz-proxy.js 내용을 수정하려면** → `getPtzProxySource()` 함수 본문을 수정합니다.

## 수정 파일 요약

| 목적 | 수정 파일 |
|------|----------|
| proxy 소스 내용 변경 | `app/api/download/ptz-proxy/route.ts` |
| 다운로드 링크/UI 변경 | `components/proxy-download-modal.tsx` |
| EXE 파일 직접 제공 | `public/downloads/` 에 파일 배치 + 위 두 파일 수정 |
| 팝업 문구/안내 변경 | `components/proxy-download-modal.tsx` |
