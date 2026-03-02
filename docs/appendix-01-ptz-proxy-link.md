# ptz-proxy 파일 첨부 방법

## 현재 구조 요약

다운로드 팝업과 파일 제공은 2개 파일로 관리됩니다.

파일 1: app/api/download/ptz-proxy/route.ts

```
다운로드되는 ZIP 안의 모든 파일 내용이 이 파일에 문자열로 하드코딩되어 있습니다.

ZIP 생성 함수:

getPtzProxySource() → ptz-proxy.js (핵심 proxy 서버)

getPackageJson() → package.json

getStartBat() → start.bat (Windows 실행)

getBuildExeBat() → build-exe.bat (EXE 빌드 스크립트)

getReadme() → README.md

ptz-proxy.js 내용을 바꾸고 싶다면 → getPtzProxySource() 함수 수정
```

파일 2: components/proxy-download-modal.tsx

```
팝업 UI와 다운로드 링크를 정의합니다.
typescriptconst downloadLinks = [
{ url: 'https://github.com/...', // GitHub 링크
{ url: '/api/download/ptz-proxy', // 서버 동적 ZIP
...
```

미
리 빌드된 EXE를 직접 제공하려면

```
public/downloads/ptz-proxy.exe 파일 배치
proxy-download-modal.tsx에 링크 추가:
```

typescript{ name: 'Windows EXE', url: '/downloads/ptz-proxy.exe', isLocal: true }

EXE 빌드는 ZIP 안의 build-exe.bat을 실행하면 됩니다 (npx pkg 사용).

-->

## 현재, 이 모든 것을 admin 로그인시 admin 페이지에서 조회 설정 가능하게 수정함
