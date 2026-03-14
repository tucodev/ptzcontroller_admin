# 라이선스 요청 개선: 관리자 알림 + 전역 polling + 이탈 안내

## Context
현재 라이선스 요청 후 관리자 승인을 기다리는 동안:
1. **관리자**는 요청이 들어온 줄 모름 → 승인 지연
2. **사용자**는 설정 모달(SettingsModal) 안에서만 polling → 모달 닫거나 페이지 이동하면 polling 중단
3. 사용자가 기다리다 페이지를 벗어나면 승인 여부를 알 수 없음

## 변경 요약

### A. 관리자에게 이메일 알림 (라이선스 요청 시)
### B. 사용자 UX 개선: 전역 polling + 이탈 안내 + 재접속 시 자동 감지

---

## A. 관리자 이메일 알림

### A-1. `lib/email.ts` — `sendLicenseRequestNotifyEmail()` 추가
- 새 함수: 관리자에게 "라이선스 요청이 접수되었습니다" 이메일 발송
- 내용: 요청자 이름, 이메일, 소속, 머신 ID, 요청 시간
- 라이선스 서버 관리 페이지 링크 포함 (`APP_URL` 환경변수 활용)
- SMTP 미설정 시 무시 (기존 패턴과 동일)

### A-2. `app/api/license/request-online/route.ts` — 요청 성공 시 알림 발송
- 라이선스 서버에 요청 전송 후 `status === 'pending'` 반환 시
- 관리자 이메일 조회 (Prisma: `role === 'admin'` 인 사용자)
- `sendLicenseRequestNotifyEmail()` 호출
- 알림 발송 실패해도 요청 자체는 성공 (fire-and-forget)

---

## B. 사용자 UX 개선

### B-1. `components/providers.tsx` — `LicensePollingProvider` 추가
전역 Context로 라이선스 polling을 관리:

```
<Providers>
  <ThemeProvider>
    <SessionProvider>
      <LicensePollingProvider>   ← 새로 추가
        {children}
      </LicensePollingProvider>
    </SessionProvider>
  </ThemeProvider>
</Providers>
```

**LicensePollingProvider 동작:**
- 마운트 시 `localStorage('ptz_lic_reqid')` 확인
- requestId 존재 → 30초마다 `GET /api/license/poll?requestId=...` polling
- 승인 감지 시:
  - `autoSaveLicense()` 호출 (Desktop: 자동 저장)
  - Context state 업데이트 → 구독 중인 컴포넌트에 알림
  - `localStorage` requestId 제거
- 거절 감지 시: Context state 업데이트, localStorage 정리

**Context 인터페이스:**
```typescript
interface LicensePollingContext {
  pendingRequestId: string | null;
  licenseStatus: 'none' | 'pending' | 'approved' | 'rejected';
  licenseMessage: string;
  licenseB64: string;
  dismissNotification: () => void;
}
```

### B-2. `app/dashboard/page.tsx` — 라이선스 승인 배너 표시
- `useLicensePolling()` hook으로 전역 상태 구독
- `licenseStatus === 'approved'` 이면 상단 배너:
  - Electron: "라이선스가 승인되었습니다! 재시작하면 적용됩니다."
  - Browser: "라이선스가 승인되었습니다. [다운로드]" 버튼 표시
- `licenseStatus === 'rejected'` 이면: "라이선스 요청이 거절되었습니다. 관리자에게 문의하세요."
- [닫기] 클릭 시 `dismissNotification()` 호출

### B-3. `components/settings-modal.tsx` — 기존 polling 제거, 전역 Context 사용
- 기존 `pollRef`, `startPolling()`, `doPoll()` 제거
- `useLicensePolling()` Context에서 상태 읽기
- 요청 전송 성공 시 → Context에 requestId 설정 → 전역 polling 시작
- "관리자 승인 시 자동으로 알려드립니다. 이 화면을 닫아도 됩니다." 안내 메시지 추가

### B-4. `components/settings-modal.tsx` — pending 상태 안내 문구 개선
- 현재: "관리자 승인을 기다리는 중입니다..."
- 변경: "관리자 승인을 기다리는 중입니다. 이 화면을 닫거나 다른 페이지로 이동해도 승인 시 자동으로 알려드립니다."

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `lib/email.ts` | `sendLicenseRequestNotifyEmail()` 추가 |
| `app/api/license/request-online/route.ts` | 요청 성공 시 관리자 이메일 알림 |
| `components/providers.tsx` | `LicensePollingProvider` Context 추가 |
| `app/dashboard/page.tsx` | 라이선스 승인/거절 배너 표시 |
| `components/settings-modal.tsx` | 로컬 polling → 전역 Context 전환, 안내 문구 개선 |

## 수정하지 않는 것
- DB 스키마 — 변경 없음 (localStorage + 기존 라이선스 서버 DB 활용)
- 라이선스 서버 (`ptz_license_server`) — 변경 없음 (기존 API 그대로 사용)
- `LicenseRequestDialog.tsx` — 변경 없음

## 검증
1. 라이선스 요청 → 관리자에게 이메일 도착 확인
2. 요청 후 설정 모달 닫기 → 대시보드에서 다른 작업 → 관리자 승인 → 배너 자동 표시
3. 요청 후 페이지 새로고침 → localStorage에서 requestId 복원 → polling 재개
4. Desktop: 승인 시 자동 저장 확인
5. Browser: 승인 시 다운로드 버튼 표시 → 클릭으로 저장
6. SMTP 미설정 시 관리자 알림 건너뛰고 요청은 정상 처리
