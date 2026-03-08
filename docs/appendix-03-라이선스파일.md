📋 .ptzreq 파일 구조 분석
생성 코드 (app/api/license/request/route.ts 라인 ~30-50)
Copyconst payload = {
  userId,           // 사용자 ID
  userName,         // 사용자 이름
  userOrg,          // 회사/소속
  userEmail,        // 이메일
  machineId,        // 기기 ID (첫 번째)
  machineIds,       // 기기 ID 배열 (모든 기기)
  requestedAt,      // 요청 시간 (ISO 8601)
  product: PRODUCT_ID,  // "PTZ-OFFLINE"
};

const sig = crypto
  .createHmac("sha256", MASTER_SECRET)
  .update(JSON.stringify({ machineId, machineIds, requestedAt, product: PRODUCT_ID }))
  .digest("hex")
  .slice(0, 16);  // 16자리 서명

const content = Buffer.from(
  JSON.stringify({ ...payload, sig }, null, 2)
).toString("base64");  // Base64 인코딩
📊 .ptzreq 파일 내용 예시
Base64로 인코딩된 JSON 형식:
Copy{
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
실제 파일 (.ptzreq) 내용:
eyJ1c2VySWQiOiAiY2x3eHl6MTIzYWJjIiwgInVzZXJOYW1lIjogIkpvaG4gRG9lIiwgInVzZXJPcmciOiAi
VFlDSEUgSW5jLiIsICJ1c2VyRW1haWwiOiAiam9obkB0eWNoZS5wcm8iLCAibWFjaGluZUlkIjogIkhXSUQt
YTFiMmMiLCAibWFjaGluZUlkcyI6IFsiSFdJRC1hMWIyYyIsICJIV0lELWQ0ZTVmIiwgIkhXSUQtZzZoN2ki
XSwgInJlcXVlc3RlZEF0IjogIjIwMjYtMDMtMDdUMjA6MDA6MDBaIiwgInByb2R1Y3QiOiAiUFRaLU9GRkxJ
TkUiLCAic2lnIjogImUxZjJnM2g0aTVqNms3bDgiIH0=
🔐 파일 구조 요약
필드	타입	설명	예시
userId	string	사용자 고유 ID	clwxyz123abc
userName	string	사용자 이름	John Doe
userOrg	string	회사/소속	TYCHE Inc.
userEmail	string	이메일	john@tyche.pro
machineId	string	주요 기기 ID (HWID)	HWID-a1b2c
machineIds	string[]	모든 기기 ID 목록	["HWID-a1b2c", "HWID-d4e5f", ...]
requestedAt	string	요청 시간 (ISO 8601)	2026-03-07T20:00:00Z
product	string	제품 ID (고정값)	PTZ-OFFLINE
sig	string	HMAC-SHA256 서명 (16자)	e1f2g3h4i5j6k7l8
🔍 HWID (machineId) 생성 방식
getAllMachineIds() 함수 (lib/license.ts):

Copy// Windows: CPU HWID + NIC MACs
// macOS: IOPlatformUUID + NIC MACs
// Linux: /etc/machine-id + NIC MACs

// 각 ID는 SHA256 해시의 첫 16자
// 형식: HWID-xxxxx
📥 라이선스 서버에서 해야 할 일
.ptzreq 파일을 Base64 디코드
JSON 파싱
sig 필드로 서명 검증
사용자 정보 확인:
userId, userName, userOrg, userEmail
machineIds 확인:
등록된 기기인지 확인
라이선스 개수 제한 체크
라이선스 파일 생성:
.ptzlic 형식 (Base64 인코딩된 JSON)
서명 포함
✅ 결론
.ptzreq 파일은:

✅ Base64 인코딩된 JSON
✅ 사용자 정보 (ID, 이름, 이메일, 회사)
✅ 기기 정보 (HWID 목록)
✅ 요청 시간
✅ HMAC-SHA256 서명 (위변조 방지)
이 정보를 바탕으로 라이선스 서버가 .ptzlic 파일을 생성해서 반환합니다.

