# 라이선스 파일 (.ptzreq / .ptzlic) 구조

## .ptzreq 파일 (라이선스 요청)

### 생성 위치

`app/api/license/request/route.ts`

### 파일 형식

Base64로 인코딩된 JSON 문자열입니다.

### JSON 구조

```json
{
  "userId": "clwxyz123abc",
  "userName": "John Doe",
  "userOrg": "TYCHE Inc.",
  "userEmail": "john@tyche.pro",
  "machineId": "HWID-a1b2c",
  "machineIds": [
    "HWID-a1b2c",
    "HWID-d4e5f",
    "HWID-g6h7i"
  ],
  "requestedAt": "2026-03-07T20:00:00Z",
  "product": "PTZ-OFFLINE",
  "sig": "e1f2g3h4i5j6k7l8"
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| userId | string | 사용자 고유 ID |
| userName | string | 사용자 이름 |
| userOrg | string | 회사/소속 |
| userEmail | string | 이메일 |
| machineId | string | 주요 기기 ID (HWID) |
| machineIds | string[] | 모든 기기 ID 목록 |
| requestedAt | string | 요청 시간 (ISO 8601) |
| product | string | 제품 ID (고정값: `PTZ-OFFLINE`) |
| sig | string | HMAC-SHA256 서명 (16자) |

### 서명 생성

```javascript
const sig = crypto
  .createHmac("sha256", MASTER_SECRET)
  .update(JSON.stringify({ machineId, machineIds, requestedAt, product: PRODUCT_ID }))
  .digest("hex")
  .slice(0, 16);  // 16자리 서명
```

## HWID (machineId) 생성 방식

`lib/license.ts`의 `getAllMachineIds()` 함수에서 생성합니다.

| 플랫폼 | 소스 |
|--------|------|
| Windows | CPU HWID + NIC MACs |
| macOS | IOPlatformUUID + NIC MACs |
| Linux | /etc/machine-id + NIC MACs |

각 ID는 SHA256 해시의 첫 16자입니다.

## 라이선스 서버의 처리 흐름

1. `.ptzreq` 파일을 Base64 디코드
2. JSON 파싱
3. `sig` 필드로 서명 검증
4. 사용자 정보 확인 (userId, userName, userOrg, userEmail)
5. machineIds 확인 (등록된 기기인지, 라이선스 개수 제한 체크)
6. `.ptzlic` 파일 생성 (Base64 인코딩된 JSON + 서명)

## .ptzlic 파일 (발급된 라이선스)

라이선스 서버가 생성하여 반환하는 파일입니다.
Desktop 앱의 `C:\ProgramData\PTZController\offline.ptzlic` 에 저장됩니다.
오프라인 모드 진입 시 이 파일의 유효성을 검증합니다.
