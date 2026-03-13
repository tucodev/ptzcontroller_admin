# PTZ Controller 시스템 코드 리뷰 보고서

> **작성일**: 2026-03-13
> **대상**: Admin Web / PTZ Proxy / Desktop / License Server
> **분류**: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## 목차

1. [시스템 구성](#1-시스템-구성)
2. [Admin Web (Next.js)](#2-admin-web-nextjs)
3. [PTZ Proxy (Electron)](#3-ptz-proxy-electron)
4. [Desktop (Electron)](#4-desktop-electron)
5. [License Server (Express)](#5-license-server-express)
6. [공통 이슈](#6-공통-이슈)
7. [개선 우선순위 요약](#7-개선-우선순위-요약)

---

## 1. 시스템 구성

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Admin Web   │◄───►│  PTZ Proxy   │◄───►│  카메라 장치  │
│  (Next.js)   │ WS  │  (Electron)  │ TCP/ │  PelcoD/Ujin │
│              │     │              │Serial│  /ONVIF      │
└──────┬───────┘     └──────────────┘     └─────────────┘
       │
       │ HTTP
┌──────┴───────┐     ┌──────────────┐
│   Desktop    │     │License Server│
│  (Electron   │     │  (Express)   │
│   Wrapper)   │     │  SQLite/Neon │
└──────────────┘     └──────────────┘
```

---

## 2. Admin Web (Next.js)

### 🔴 Critical

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| A-1 | `proxy-token.ts:25` | 토큰 시크릿 하드코딩 | `process.env` 미설정 시 `'ptz-proxy-token-secret'` 폴백 → 토큰 위조 가능 |
| A-2 | `dashboard/page.tsx` | Auto Query 타이머 누적 | PelcoD 4축 setTimeout이 interval 변경 시 정리 안 됨 → 중복 명령, 위치 데이터 오염 |
| A-3 | `dashboard/page.tsx` | Hex 로그 버퍼 미정리 | 컴포넌트 언마운트 시 `hexLogBuffer.current` 미클리어 → 장시간 운용 시 메모리 누수 |

### 🟠 High

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| A-4 | `dashboard/page.tsx` | 카메라 전환 Race Condition | WebSocket 연결 중 다른 카메라 선택 시 잘못된 카메라에 명령 전송 |
| A-5 | `add-camera-modal.tsx` | 포트 범위 미검증 | 0, -1, 99999 입력 가능 → 연결 실패 시 원인 파악 어려움 |
| A-6 | `connect/route.ts` | proxyUrl 토큰 노출 | API 응답에 토큰 포함된 URL 반환, CORS 미설정 시 외부 사이트에서 탈취 가능 |

### 🟡 Medium

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| A-7 | `settings-modal.tsx` | handleSave 성공 미확인 | fetch 응답 상태 확인 없이 `onClose()` 호출 → 저장 실패 시 사용자 인지 불가 |
| A-8 | `settings-modal.tsx` | 라이선스 폴링 에러 무시 | catch 블록이 비어있어 서버 장애 시 "승인 대기" 상태 영구 표시 |
| A-9 | `ptz-control-panel.tsx` | 속도 슬라이더 디바운싱 없음 | 드래그 시 초당 100+ setState + WebSocket 전송 |
| A-10 | `settings-modal.tsx` | proxyPort 범위 미검증 | 1~65535 범위 확인 없이 저장 |
| A-11 | `config-manager.ts` | 캐시 무효화 O(n) | 모든 키 순회 → 사용자/카메라 수 증가 시 성능 저하 |
| A-12 | `admin-modal.tsx` | 사용자 목록 페이지네이션 없음 | 전체 로드 → 대량 사용자 시 UI 무응답 |

### 🟢 Low

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| A-13 | `ptz-control-panel.tsx` | 커스텀 기능 버튼 미구현 | 5개 버튼이 console.log만 출력 |
| A-14 | `config-manager.ts` | deprecated 함수 잔존 | `@deprecated` 표시된 동기 함수들이 코드에 남아있음 |
| A-15 | 전체 | i18n 미지원 | 모든 UI 문자열 한국어 하드코딩 |

---

## 3. PTZ Proxy (Electron)

### 🔴 Critical

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| P-1 | `main.js:321-324` | **인증 우회** | 토큰 검증 서버 접근 불가 시 `return true` → 인증 없이 연결 허용. DoS로 인증 무력화 가능 |

### 🟠 High

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| P-2 | `main.js:1271` | 로그에 자격증명 노출 | ONVIF username, profileToken이 로그에 평문 기록 |
| P-3 | `main.js` | HTTPS/WSS 미지원 | 평문 HTTP/WS만 사용 → MITM 공격에 취약 |
| P-4 | `main.js` | 최대 연결 수 제한 없음 | WebSocket 무제한 수용 → 메모리 고갈 DoS |
| P-5 | `main.js` | 명령 속도 제한 없음 | 초당 수천 개 명령 전송 가능 → 카메라 과부하 |

### 🟡 Medium

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| P-6 | `main.js:1219-1411` | 인증 중 메시지 유실 | bufferHandler 제거 후 messageHandler 등록 전 메시지 누락 구간 |
| P-7 | `main.js:1002-1020` | TCP rxTimer 미정리 | flushRx() 직접 호출 시 rxTimer 정리 안 됨 → 소켓 종료 후 타이머 잔존 |
| P-8 | `main.js:1531-1543` | 포트 변경 Race Condition | 연속 클릭 시 stopServer 콜백 중복 → 서버 다중 기동 |
| P-9 | `main.js:1248` | WebSocket 메시지 구조 미검증 | `msg.config`가 null이면 후속 속성 접근에서 크래시 |
| P-10 | `main.js:1278-1290` | ONVIF 프로필 0개 무시 | profiles 빈 배열 반환 시 에러 없이 진행 → 이후 PTZ 명령 실패 |
| P-11 | `main.js` | 순환 버퍼 순서 오류 | `getStatus()`에서 `logBuffer.forEach()` → 200개 초과 후 시간순 정렬 깨짐 |
| P-12 | `index.html` | entry.time XSS 가능성 | `escapeHtml()` 미적용 → time 필드 조작 시 DOM XSS |

### 🟢 Low

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| P-13 | `main.js:568` | 속도 변환 정밀도 손실 | `Math.round()`로 50%와 51%가 동일한 바이트 값 매핑 |
| P-14 | `main.js` | 카메라 재연결 로직 없음 | 소켓 종료 시 자동 재연결 미구현 |
| P-15 | `main.js:1423` | 프로토콜 지원 주석 불일치 | 주석은 "PelcoD만 구현"이나 실제 Ujin/ONVIF 구현됨 |

---

## 4. Desktop (Electron)

### 🔴 Critical

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| D-1 | `main.js:712-713` | 프로세스 Kill 명령 인젝션 위험 | `execSync('taskkill /pid ' + proc.pid ...)` → `proc.kill()` 사용 권장 |

### 🟠 High

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| D-2 | `main.js:1286` | unhandledRejection 미처리 | console.error만 수행, UI 알림이나 종료 없음 → 앱 비정상 상태 방치 |

### 🟡 Medium

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| D-3 | `main.js:1036-1048` | 라이선스 다이얼로그 에러 미처리 | `dialog.showMessageBox()` 실패 시 대응 없음 |
| D-4 | `main.js:1232-1239` | 매 시작 시 세션 초기화 | 오프라인 라이선스 유효해도 무조건 재로그인 필요 |
| D-5 | `forge.config.js:76` | 미사용 ws 모듈 unpack | ws 모듈 미사용이나 unpackDir에 포함 → 패키지 크기 증가 |

### 🟢 Low

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| D-6 | `preload.js:49` | process.platform 직접 노출 | IPC 패턴 미경유, 아키텍처 일관성 부족 |
| D-7 | `main.js:740` | .env 파일 보안 | LICENSE_SECRET을 main process에 주입 → 문서화 필요 |

---

## 5. License Server (Express)

### 🔴 Critical

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| L-1 | `server.js:74` | LICENSE_SECRET 기본값 | `"TYCHE-PTZ-LICENSE-SECRET-2024"` → 미설정 시 라이선스 위조 가능 |
| L-2 | `server.js:75` | JWT_SECRET 파생 | LICENSE_SECRET에서 파생 → 둘 다 기본값이면 관리자 세션 위조 가능 |
| L-3 | `db/neon.js` | normalizeHistory adminId 누락 | `adminId` 필드 정규화 안 됨 → Neon DB에서 history 조회 시 undefined |

### 🟠 High

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| L-4 | `server.js:430-487` | 이메일 검증 없음 | userEmail 형식 미검증 → SMTP 오류, 스푸핑 |
| L-5 | `server.js` | Rate Limiting 없음 | 공개 엔드포인트 무제한 → DoS, DB 스팸 |
| L-6 | `server.js:154-156` | TLS 검증 비활성 | `rejectUnauthorized: false` → SMTP MITM 가능 |
| L-7 | `.env.example` | 실 자격증명 노출 | DB URL, SMTP 비밀번호가 예제 파일에 포함 |

### 🟡 Medium

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| L-8 | `server.js:683-686` | 비밀번호 복잡도 미검증 | 길이만 확인 (8자), 대소문자/숫자/특수문자 요구 없음 |
| L-9 | `server.js:932` | DB 에러 메시지 노출 | `e.message`를 클라이언트에 직접 반환 → 정보 유출 |
| L-10 | `server.js:1146-1166` | 수동 발급 Race Condition | findByUserMachine → insert 사이에 중복 생성 가능 |
| L-11 | `server.js` | 라이선스 폐기 기능 없음 | 승인 후 취소 불가 → 유출된 라이선스 무력화 불가 |
| L-12 | `server.js:85-91` | 세션 활동 타임아웃 없음 | JWT 8시간 고정 → 토큰 탈취 시 장시간 악용 가능 |
| L-13 | `server.js` | 감사 로그 미흡 | 비밀번호 변경, 라이선스 승인 등의 구조화된 감사 추적 없음 |
| L-14 | `server.js:1029-1033` | 만료일 최대치 미제한 | 100년 후 만료일 설정 가능 → 영구 라이선스 |

### 🟢 Low

| # | 파일 | 문제 | 설명 |
|---|------|------|------|
| L-15 | `server.js:263,308` | 지원 이메일 하드코딩 | `cumtyche@gmail.com` → 환경변수로 분리 필요 |
| L-16 | `server.js:1218` | HTTP 207 오용 | WebDAV 상태코드를 SMTP 실패에 사용 |
| L-17 | `server.js` | 히스토리 페이지네이션 없음 | 고정 LIMIT 500 → 대량 데이터 시 성능 저하 |
| L-18 | `db/sqlite.js` | 소프트 삭제 미지원 | 하드 삭제만 → 감사 추적 불가 |
| L-19 | 전체 | 매직 문자열 | "pending", "approved" 등 상수 미정의 |

---

## 6. 공통 이슈

### 보안

| # | 범위 | 문제 | 설명 |
|---|------|------|------|
| C-1 | Admin + Proxy | 토큰 시크릿 하드코딩 폴백 | 양쪽 모두 기본값 사용 시 인증 무력화 |
| C-2 | Proxy + Admin | HTTP 평문 통신 | Proxy↔Admin 간 ws:// 사용, 카메라 자격증명 평문 전송 |
| C-3 | 전체 | 단위 테스트 없음 | 프로토콜 빌더, 인증, 라이선스 검증 등 테스트 미작성 |

### 안정성

| # | 범위 | 문제 | 설명 |
|---|------|------|------|
| C-4 | Admin + Proxy | 입력 검증 부족 | 포트, 주소, 프로토콜 등 사용자 입력 검증 미흡 |
| C-5 | Admin + Desktop | 에러 무시 패턴 | `catch { }` 또는 `catch { /* ignore */ }` 다수 |

### 성능

| # | 범위 | 문제 | 설명 |
|---|------|------|------|
| C-6 | Admin | 디바운싱 부재 | 슬라이더, 설정 변경 등에서 과도한 이벤트 발생 |
| C-7 | License Server | 페이지네이션 부재 | 사용자 목록, 히스토리 전체 로드 |

---

## 7. 개선 우선순위 요약

### 즉시 수정 (Critical)

| 우선순위 | ID | 작업 | 예상 공수 |
|:---:|------|------|:---:|
| 1 | P-1 | Proxy 토큰 검증 실패 시 `return false` 변경 | 5분 |
| 2 | L-1,L-2 | License Server SECRET/JWT 기본값 제거, 미설정 시 기동 차단 | 30분 |
| 3 | A-1 | Admin 토큰 시크릿 하드코딩 폴백 제거 | 15분 |
| 4 | L-3 | Neon normalizeHistory adminId 정규화 추가 | 10분 |
| 5 | D-1 | Desktop taskkill → process.kill() 변경 | 15분 |

### 이번 릴리스 (High)

| 우선순위 | ID | 작업 | 예상 공수 |
|:---:|------|------|:---:|
| 6 | P-2 | 로그에서 자격증명 마스킹 | 1시간 |
| 7 | P-4,P-5 | 최대 연결 수 + 명령 속도 제한 추가 | 2시간 |
| 8 | A-2 | Auto Query setTimeout 누적 방지 | 1시간 |
| 9 | A-4 | 카메라 전환 Race Condition 방지 | 1시간 |
| 10 | L-5 | Rate Limiting 미들웨어 추가 | 1시간 |
| 11 | L-7 | .env.example에서 실 자격증명 제거 | 10분 |
| 12 | A-5,A-10 | 포트 범위 검증 추가 | 30분 |

### 다음 릴리스 (Medium)

| 우선순위 | ID | 작업 | 예상 공수 |
|:---:|------|------|:---:|
| 13 | A-7 | handleSave 응답 확인 후 닫기 | 30분 |
| 14 | A-8 | 라이선스 폴링 에러 UI 표시 | 30분 |
| 15 | A-9 | 속도 슬라이더 디바운싱 | 30분 |
| 16 | P-6 | 인증 구간 메시지 버퍼링 수정 | 1시간 |
| 17 | P-8 | 포트 변경 큐 기반 처리 | 1시간 |
| 18 | P-9 | WebSocket 메시지 스키마 검증 | 2시간 |
| 19 | L-8 | 비밀번호 복잡도 검증 추가 | 30분 |
| 20 | L-11 | 라이선스 폐기 엔드포인트 | 3시간 |
| 21 | L-12 | JWT 단축 + Refresh Token | 3시간 |
| 22 | A-12 | 사용자 목록 페이지네이션 | 2시간 |
| 23 | D-2 | unhandledRejection 처리 | 30분 |

### 장기 개선 (Low)

| ID | 작업 | 예상 공수 |
|------|------|:---:|
| C-3 | 단위 테스트 작성 (프로토콜, 인증, 라이선스) | 2~3일 |
| P-3 | WSS/HTTPS 지원 추가 | 1일 |
| P-14 | 카메라 자동 재연결 | 3시간 |
| L-13 | 감사 로그 테이블 및 기록 | 1일 |
| A-15 | i18n 시스템 도입 | 2~3일 |
| A-14 | deprecated 코드 정리 | 1시간 |

---

## 통계 요약

| 프로그램 | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 합계 |
|----------|:---:|:---:|:---:|:---:|:---:|
| Admin Web | 3 | 3 | 6 | 3 | **15** |
| PTZ Proxy | 1 | 4 | 7 | 3 | **15** |
| Desktop | 1 | 1 | 3 | 2 | **7** |
| License Server | 3 | 4 | 7 | 5 | **19** |
| 공통 | - | - | - | - | **7** |
| **합계** | **8** | **12** | **23** | **13** | **63** |

---

*PTZ Controller System Code Review Report — TYCHE Inc.*
