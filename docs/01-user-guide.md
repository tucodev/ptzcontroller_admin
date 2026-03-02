# PTZ Controller 사용자 설명서

## 목차
1. [소개](#소개)
2. [시스템 요구사항](#시스템-요구사항)
3. [로그인](#로그인)
4. [대시보드](#대시보드)
5. [카메라 추가](#카메라-추가)
6. [PTZ 제어](#ptz-제어)
7. [설정](#설정)
8. [동작 모드](#동작-모드)

---

## 소개

PTZ Controller는 다양한 프로토콜(PelcoD, ONVIF, ujin 등)을 지원하는 웹 기반 PTZ 카메라 제어 시스템입니다.

### 주요 기능
- **다중 프로토콜 지원**: PelcoD, ONVIF, ujin(PelcoD 변형), 커스텀 프로토콜
- **PTZ 제어**: Pan, Tilt, Zoom, Focus 제어
- **프리셋 관리**: 최대 255개의 프리셋 저장/호출
- **두 가지 동작 모드**: Direct 모드와 Proxy 모드
- **테마 지원**: Light, Dark, System 테마

---

## 시스템 요구사항

### 웹 브라우저
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 서버 (Direct 모드)
- Node.js 18.x 이상
- PTZ 카메라와 네트워크 연결

### Proxy 모드
- 브라우저가 실행되는 PC에 PTZ 카메라 접근 가능
- ptz-proxy 서비스 실행

---

## 로그인

### 계정 생성
1. 로그인 페이지에서 "Don't have an account? Sign up" 클릭
2. 이름, 이메일, 비밀번호 입력
3. "Create Account" 버튼 클릭

### 로그인
1. 이메일과 비밀번호 입력
2. "Sign In" 버튼 클릭
3. 대시보드로 자동 이동

### 기본 테스트 계정
- Email: `test@example.com`
- Password: `password123`

---

## 대시보드

대시보드는 크게 두 영역으로 구성됩니다:

### 왼쪽: 카메라 목록
- 등록된 카메라 목록 표시
- 카메라 선택 시 오른쪽 제어 패널 활성화
- `+` 버튼으로 새 카메라 추가
- 🗑️ 버튼으로 카메라 삭제
- 🔄 버튼으로 목록 새로고침

### 오른쪽: PTZ 제어 패널
- 선택된 카메라의 정보 표시
- 연결/연결해제 버튼
- PTZ 제어 인터페이스

---

## 카메라 추가

`+` 버튼을 클릭하면 카메라 추가 모달이 나타납니다.

### 기본 설정

| 필드 | 설명 | 예시 |
|------|------|------|
| Camera Name | 카메라 식별 이름 | Main Camera |
| Protocol | 통신 프로토콜 | PelcoD, ONVIF, ujin, Custom |
| Operation Mode | 동작 모드 | Direct 또는 Proxy |

### Direct 모드 설정

| 필드 | 설명 | 예시 |
|------|------|------|
| Host/IP | 카메라 IP 주소 | 192.168.1.100 |
| Port | 통신 포트 | 5000 |
| Device Address | PelcoD/ujin 장치 주소 (1-255) | 1 |
| Username | ONVIF 사용자명 | admin |
| Password | ONVIF 비밀번호 | ******* |

### Proxy 모드 설정

| 필드 | 설명 | 예시 |
|------|------|------|
| Proxy WebSocket URL | ptz-proxy 서버 주소 | ws://localhost:9902 |

---

## PTZ 제어

### 연결
1. 카메라 목록에서 카메라 선택
2. "Connect" 버튼 클릭
3. 연결 상태가 "connected"로 변경되면 제어 가능

### Pan/Tilt 제어
- **방향 버튼**: ⬆️⬇️⬅️➡️ 버튼을 **누르고 있는 동안** 이동
- **정지**: 가운데 ⏹️ 버튼 또는 버튼에서 손을 떼면 자동 정지
- **속도 조절**: "Pan/Tilt Speed" 슬라이더로 조절 (1-100%)

### Zoom 제어
- **Zoom In**: 확대 (+ 버튼)
- **Zoom Out**: 축소 (- 버튼)
- **속도 조절**: "Zoom Speed" 슬라이더로 조절

### Focus 제어
- **Focus Near**: 가까운 곳에 초점
- **Focus Far**: 먼 곳에 초점
- **속도 조절**: "Focus Speed" 슬라이더로 조절

### 프리셋
- **빠른 프리셋**: 1-6 버튼으로 즉시 호출
- **커스텀 프리셋**: 숫자 입력 후 "Go" 버튼
- 지원 범위: 1-255

---

## 설정

헤더의 ⚙️ 아이콘을 클릭하면 설정 모달이 나타납니다.

### 설정 항목

| 설정 | 설명 | 옵션 |
|------|------|------|
| Default Protocol | 새 카메라 추가 시 기본 프로토콜 | PelcoD, ONVIF, ujin, Custom |
| Default Operation Mode | 기본 동작 모드 | Direct, Proxy |
| Proxy WebSocket Port | Proxy 서버 기본 포트 | 9902 |
| Log Level | 로그 레벨 | Debug, Info, Warning, Error |
| Theme | UI 테마 | Light, Dark, System |

### 테마 변경
1. Settings 모달 열기
2. Theme 섹션에서 원하는 테마 선택
3. 즉시 UI에 적용됨
4. "Save Settings" 클릭하여 저장

---

## 동작 모드

### Mode 2: Direct 모드
```
[Web Server] ──────────────────► [PTZ Camera]
   (UI + 제어 로직)                   (Public IP 필요)
```

**사용 시나리오**:
- PTZ 카메라가 서버에서 직접 접근 가능할 때
- 클라우드 서버에서 운영할 때
- 카메라가 Public IP를 가지고 있을 때

### Mode 3: Proxy 모드
```
[Web Server] ◄──► [Browser] ◄──► [PTZ-Proxy] ──► [PTZ Camera]
   (UI만)           (WebSocket)    (로컬 PC)        (Private IP OK)
```

**사용 시나리오**:
- PTZ 카메라가 Private 네트워크에 있을 때
- 서버에서 카메라에 직접 접근 불가할 때
- 사용자 PC에서만 카메라 접근 가능할 때

### Proxy 모드 사용 방법
1. PTZ 카메라에 접근 가능한 PC에서 ptz-proxy 실행
2. 카메라 추가 시 Operation Mode를 "Proxy"로 선택
3. Proxy WebSocket URL 입력 (예: `ws://localhost:9902`)
4. 연결하면 브라우저 → Proxy → 카메라로 명령 전달

---

## 문제 해결

### 연결이 안 될 때
1. 카메라 IP와 포트 확인
2. 방화벽 설정 확인
3. 프로토콜 설정이 카메라와 일치하는지 확인

### Proxy 모드에서 연결 실패
1. ptz-proxy 서비스가 실행 중인지 확인
2. WebSocket URL이 정확한지 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### PTZ가 움직이지 않을 때
1. 연결 상태가 "connected"인지 확인
2. 장치 주소(Address)가 카메라 설정과 일치하는지 확인
3. 속도 설정이 0이 아닌지 확인
