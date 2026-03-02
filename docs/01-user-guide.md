# PTZ Controller 사용자 설명서

## 목차

1. [소개](#소개)
2. [시스템 구성](#시스템-구성)
3. [계정 및 로그인](#계정-및-로그인)
4. [대시보드](#대시보드)
5. [카메라 추가](#카메라-추가)
6. [PTZ 제어](#ptz-제어)
7. [설정](#설정)
8. [동작 모드](#동작-모드)
9. [관리자 기능](#관리자-기능)
10. [문제 해결](#문제-해결)

---

## 소개

PTZ Controller는 PelcoD, ONVIF, ujin 등 다양한 프로토콜을 지원하는 웹 기반 PTZ 카메라 제어 시스템입니다.  
웹 브라우저 또는 Windows 데스크톱 앱(Electron)으로 사용할 수 있습니다.

### 주요 기능

- **다중 프로토콜 지원**: PelcoD, ONVIF, ujin(PelcoD 변형), 커스텀 프로토콜
- **PTZ 제어**: Pan, Tilt, Zoom, Focus 제어
- **프리셋 관리**: 최대 255개 프리셋 저장/호출
- **두 가지 동작 모드**: Direct 모드 / Proxy 모드
- **Hex 모니터**: 실시간 TX/RX 패킷 표시
- **테마 지원**: Light, Dark, System
- **관리자 기능**: 사용자 관리, PTZ Proxy 배포 파일 업로드

---

## 시스템 구성

### 3가지 구성 요소

| 구성 요소 | 폴더 | 설명 |
|-----------|------|------|
| **Web App** | `ptzcontroller_admin/` | Next.js 웹 서버 (UI + API) |
| **Desktop App** | `ptzcontroller-desktop/` | Electron 래퍼 (Windows EXE) |
| **PTZ Proxy** | `ptz-proxy-electron/` | WebSocket 프록시 (GUI 트레이 앱) |

### 폴더 구조 (전제 조건)

```
(상위 폴더)/
├── ptzcontroller_admin/       ← Next.js 웹앱 소스
└── ptzcontroller-desktop/     ← Electron 데스크톱 래퍼
└── ptz-proxy-electron/        ← Electron PTZ Proxy
```

### 웹 브라우저 요구사항

- Chrome 90+, 
- Firefox 88+, 
- Safari 14+, Edge 90+

---

## 계정 및 로그인

### 첫 번째 가입자 자동 admin

**최초 회원가입 시 자동으로 admin(관리자) 권한이 부여됩니다.**  
단, DB에 `seed` 계정(`john@doe.com`)이 있더라도 이 계정은 제외하고 판단합니다.  
즉, seed 계정만 있는 상태에서 처음 가입한 실제 사용자는 admin이 됩니다.

### 회원가입

1. 로그인 페이지에서 **"Don't have an account? Sign up"** 클릭
2. 이름, 이메일, 비밀번호 입력
3. **"Create Account"** 버튼 클릭

### 로그인

1. 이메일과 비밀번호 입력
2. **"Sign In"** 버튼 클릭
3. 대시보드로 자동 이동

### Seed 테스트 계정 (개발/테스트용)

`yarn prisma db seed` 실행 시 자동 생성되는 테스트 계정:

- Email: `john@doe.com`
- Password: `johndoe123`

> ⚠️ 운영 환경에서는 이 계정의 비밀번호를 변경하거나 관리자 페이지에서 삭제하세요.

---

## 대시보드

대시보드는 세 영역으로 구성됩니다.

### 헤더

| 버튼 | 설명 |
|------|------|
| 🛡️ (amber) | 관리자 설정 — **admin 계정에만 표시** |
| ⚙️ | 앱 설정 (테마, 기본 프로토콜 등) |
| 로그아웃 | 세션 종료 |

### 왼쪽: 카메라 목록

- 등록된 카메라 목록 표시
- `+` 버튼으로 새 카메라 추가
- ✏️ 버튼으로 카메라 편집
- 🗑️ 버튼으로 카메라 삭제
- 🔄 버튼으로 목록 새로고침
- 카메라 선택 시 오른쪽 제어 패널 활성화

### 오른쪽: PTZ 제어 패널

- 선택된 카메라 정보 및 모드 표시
- Connect / Disconnect 버튼
- PTZ 방향 패드, Zoom, Focus, 프리셋 컨트롤

### 하단: Hex 모니터

- TX(전송) / RX(수신) 패킷 실시간 표시
- 패킷 내용 16진수 표시
- 최대 500개 로그 유지, Clear 버튼으로 초기화

---

## 카메라 추가

`+` 버튼 클릭 시 카메라 추가/편집 모달이 나타납니다.

### 기본 설정

| 필드 | 설명 | 예시 |
|------|------|------|
| Camera Name | 카메라 식별 이름 | 1번 카메라 |
| Protocol | 통신 프로토콜 | PelcoD, ONVIF, ujin, Custom |
| Operation Mode | 동작 모드 | Direct 또는 Proxy |

### Direct 모드 설정

| 필드 | 설명 | 예시 |
|------|------|------|
| Host/IP | 카메라 IP 주소 | 192.168.1.100 |
| Port | 통신 포트 | 4001 |
| Device Address | PelcoD/ujin 장치 주소 (1-255) | 1 |
| Username | ONVIF 사용자명 | admin |
| Password | ONVIF 비밀번호 | — |

### Proxy 모드 설정

| 필드 | 설명 | 예시 |
|------|------|------|
| Proxy WebSocket URL | ptz-proxy 서버 주소 | ws://localhost:9902 |

---

## PTZ 제어

### 연결

1. 카메라 목록에서 카메라 선택
2. **"Connect"** 버튼 클릭
3. 연결 상태가 **"connected"** 로 바뀌면 제어 가능

**Proxy 모드**에서 연결 실패 시 자동으로 다운로드 팝업이 표시됩니다.  
(관리자가 업로드한 파일 또는 소스 ZIP 다운로드 안내)

### Pan/Tilt 제어

- **방향 버튼**: ⬆️⬇️⬅️➡️ 버튼을 **누르고 있는 동안** 이동
- **정지**: 가운데 ⏹️ 버튼 또는 버튼에서 손을 떼면 자동 정지
- **속도 조절**: Pan/Tilt Speed 슬라이더 (1–100%)

### Zoom / Focus 제어

- **Zoom In / Out**: 확대·축소
- **Focus Near / Far**: 가까운/먼 초점
- **속도 조절**: 각 슬라이더로 조절

### 프리셋

- **빠른 프리셋**: 1–6 버튼으로 즉시 호출
- **커스텀 프리셋**: 숫자 입력 후 "Go" 버튼
- 지원 범위: 1–255

---

## 설정

헤더의 ⚙️ 아이콘 클릭 시 설정 모달이 나타납니다.

| 설정 | 설명 | 옵션 |
|------|------|------|
| Default Protocol | 새 카메라 추가 시 기본 프로토콜 | PelcoD, ONVIF, ujin, Custom |
| Default Operation Mode | 기본 동작 모드 | Direct, Proxy |
| Proxy WebSocket Port | Proxy 기본 포트 | 9902 |
| Log Level | 서버 로그 수준 | Debug, Info, Warning, Error |
| Theme | UI 테마 | Light, Dark, System |

### 테마 변경

1. Settings 모달 열기
2. Theme 섹션에서 원하는 테마 선택
3. 즉시 UI에 적용됨
4. "Save Settings" 클릭하여 저장

---

## 동작 모드

### Mode 1: Direct 모드

```
[Web Server (UI + 제어)] ──TCP──► [PTZ Camera (Public IP 필요)]
```

**사용 시나리오:**
- PTZ 카메라가 서버에서 직접 접근 가능할 때
- 클라우드 서버(Cloudtype 등)에서 운영할 때

### Mode 2: Proxy 모드

```
[Web Server (UI)] ◄─HTTPS─► [Browser] ◄─WebSocket─► [PTZ Proxy] ──TCP──► [PTZ Camera]
                                                       (로컬 PC)             (Private IP)
```

**사용 시나리오:**
- PTZ 카메라가 Private 네트워크에 있을 때
- 사용자 PC에서만 카메라 접근 가능할 때

**Proxy 모드 사용 방법:**
1. PTZ 카메라에 접근 가능한 PC에서 **ptz-proxy-electron** 실행
2. 카메라 추가 시 Operation Mode를 **"Proxy"** 로 선택
3. Proxy WebSocket URL 입력 (예: `ws://localhost:9902`)
4. Connect → 브라우저 → Proxy → 카메라 순으로 명령 전달

### Proxy 연결 실패 시 자동 팝업

Proxy 연결이 5초 내에 실패하면 자동으로 다운로드 안내 팝업이 표시됩니다.

- 관리자가 `public/downloads/`에 파일을 업로드한 경우 → 해당 파일 다운로드 링크 표시
- 업로드 파일이 없는 경우 → 소스 ZIP 다운로드 또는 GitHub 링크 표시

---

## 관리자 기능

**admin 계정으로 로그인 시** 헤더에 🛡️ 버튼이 나타납니다.

### 사용자 관리 탭

| 기능 | 설명 |
|------|------|
| 사용자 목록 | 전체 사용자 조회 (이메일, 이름, 권한, 가입일) |
| 사용자 추가 | 이메일, 이름, 비밀번호, 권한(user/admin) 설정 |
| 사용자 편집 | 이름, 권한, 비밀번호 변경 |
| 사용자 삭제 | 계정 삭제 (자기 자신 삭제 불가) |

### Proxy 파일 탭

사용자가 PTZ Proxy를 다운로드할 수 있도록 파일을 미리 업로드합니다.

- **업로드 가능 형식**: `.exe`, `.zip`, `.msi`, `.dmg`, `.sh`, `.bat`, `.appimage`
- 업로드된 파일은 `public/downloads/` 폴더에 저장
- Proxy 연결 실패 팝업에서 자동으로 다운로드 링크로 표시

---

## 문제 해결

### 연결이 안 될 때 (Direct 모드)

1. 카메라 IP와 포트 확인
2. 방화벽 설정 확인
3. 프로토콜 설정이 카메라와 일치하는지 확인
4. 장치 주소(Address)가 카메라와 일치하는지 확인

### Proxy 모드에서 연결 실패

1. ptz-proxy-electron이 실행 중인지 확인 (트레이 아이콘 확인)
2. WebSocket URL이 정확한지 확인 (`ws://[IP]:9902`)
3. 방화벽에서 9902 포트 허용 여부 확인
4. 브라우저 콘솔(F12)에서 에러 메시지 확인

### PTZ가 움직이지 않을 때

1. 연결 상태가 "connected"인지 확인
2. 장치 주소(Address)가 카메라 설정과 일치하는지 확인
3. 속도 슬라이더가 0이 아닌지 확인
4. Hex 모니터에서 TX 패킷이 전송되는지 확인

### admin 버튼(🛡️)이 보이지 않을 때

1. 로그아웃 후 재로그인 (JWT 토큰 갱신)
2. Neon 대시보드 SQL Editor에서 직접 확인:
   ```sql
   SELECT email, role FROM "User";
   UPDATE "User" SET role = 'admin' WHERE email = '본인이메일';
   ```
