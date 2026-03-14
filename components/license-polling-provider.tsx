'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// ── 타입 ──────────────────────────────────────────────────────
export type LicensePollingStatus = 'none' | 'pending' | 'approved' | 'approved_no_proxy' | 'rejected';

interface LicensePollingContextType {
  /** 현재 대기 중인 요청 ID (없으면 null) */
  pendingRequestId: string | null;
  /** 라이선스 상태 */
  licenseStatus: LicensePollingStatus;
  /** 상태 메시지 */
  licenseMessage: string;
  /** 발급된 라이선스 Base64 (approved 시) */
  licenseB64: string;
  /** 만료일 (approved 시) */
  expiresAt: string;
  /** 알림 닫기 */
  dismissNotification: () => void;
  /** 외부에서 polling 시작 (settings-modal 등) */
  startPolling: (requestId: string) => void;
  /** 외부에서 상태 직접 설정 (즉시 승인 등) */
  setApproved: (licenseB64: string, expiresAt: string) => void;
  /** Proxy를 통한 라이선스 저장 재시도 */
  retrySaveViaProxy: () => Promise<void>;
}

const LicensePollingContext = createContext<LicensePollingContextType>({
  pendingRequestId: null,
  licenseStatus: 'none',
  licenseMessage: '',
  licenseB64: '',
  expiresAt: '',
  dismissNotification: () => {},
  startPolling: () => {},
  setApproved: () => {},
  retrySaveViaProxy: async () => {},
});

export const useLicensePolling = () => useContext(LicensePollingContext);

// ── 상수 ──────────────────────────────────────────────────────
const POLL_MS = 30_000;
const LS_KEY = 'ptz_lic_reqid';
const LS_RESULT_KEY = 'ptz_lic_result'; // 승인/거절 결과 보존용

// ── Proxy 포트 가져오기 (settings API → 기본 9902) ──
async function getProxyPort(): Promise<number> {
  try {
    const res = await fetch('/api/config/settings');
    if (res.ok) {
      const data = await res.json();
      const port = data?.settings?.proxyPort;
      if (port && typeof port === 'number') return port;
    }
  } catch { /* ignore */ }
  return 9902;
}

// ── Provider ──────────────────────────────────────────────────
export function LicensePollingProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicensePollingStatus>('none');
  const [licenseMessage, setLicenseMessage] = useState('');
  const [licenseB64, setLicenseB64] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 마운트 시 localStorage에서 상태 복원 ──────────────────
  useEffect(() => {
    if (!session?.user) return;

    // 1) pending 요청이 남아있으면 polling 재개
    const savedId = localStorage.getItem(LS_KEY);
    if (savedId) {
      setPendingRequestId(savedId);
      setLicenseStatus('pending');
      setLicenseMessage('관리자 승인을 기다리는 중입니다. 승인 시 알려드립니다.');
      beginPolling(savedId);
      return;
    }

    // 2) 승인/거절 결과가 남아있으면 배너 복원
    const savedResult = localStorage.getItem(LS_RESULT_KEY);
    if (savedResult) {
      try {
        const result = JSON.parse(savedResult);
        setLicenseStatus(result.status);
        setLicenseMessage(result.message);
        setLicenseB64(result.license || '');
        setExpiresAt(result.expiresAt || '');
      } catch { localStorage.removeItem(LS_RESULT_KEY); }
    }
  }, [session?.user]);

  // ── 언마운트 시 정리 ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── 결과를 localStorage에 보존 ─────────────────────────────
  const persistResult = (status: LicensePollingStatus, message: string, license = '', exp = '') => {
    localStorage.setItem(LS_RESULT_KEY, JSON.stringify({
      status, message, license, expiresAt: exp,
    }));
  };

  // ── Proxy를 통한 라이선스 저장 ─────────────────────────────
  const saveViaProxy = async (license: string): Promise<boolean> => {
    // 1차: 로컬 서버(save-shared) 시도 — Desktop / localhost 환경
    try {
      const local = await fetch('/api/license/save-shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license }),
      });
      if (local.ok) return true;
    } catch { /* 클라우드 환경이면 서버 경로가 무의미 → 무시 */ }

    // 2차: PTZ Proxy API 시도 (설정의 proxyPort 사용)
    try {
      const proxyPort = await getProxyPort();
      const proxy = await fetch(`http://localhost:${proxyPort}/api/license/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license }),
      });
      if (proxy.ok) return true;
    } catch { /* Proxy 미실행 */ }

    return false;
  };

  // ── polling 실행 ───────────────────────────────────────────
  const beginPolling = useCallback((requestId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    // 즉시 1회 실행 후 interval
    doPoll(requestId);
    pollRef.current = setInterval(() => doPoll(requestId), POLL_MS);
  }, []);

  const doPoll = async (requestId: string) => {
    try {
      const res = await fetch(`/api/license/poll?requestId=${requestId}`);
      const data = await res.json();

      if (data.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        localStorage.removeItem(LS_KEY);
        setPendingRequestId(null);
        setLicenseB64(data.license ?? '');
        setExpiresAt(data.expiresAt ?? '');

        // Proxy/로컬 서버를 통해 저장 시도
        if (data.license) {
          const saved = await saveViaProxy(data.license);
          if (saved) {
            setLicenseStatus('approved');
            setLicenseMessage('라이선스가 승인되어 자동 적용되었습니다!');
            persistResult('approved', '라이선스가 승인되어 자동 적용되었습니다!', data.license, data.expiresAt);
          } else {
            setLicenseStatus('approved_no_proxy');
            const msg = 'PTZ Proxy를 실행하여야 라이선스를 적용할 수 있습니다. PTZ Proxy를 실행하고 재시도하십시오.';
            setLicenseMessage(msg);
            persistResult('approved_no_proxy', msg, data.license, data.expiresAt);
          }
        } else {
          setLicenseStatus('approved');
          setLicenseMessage('라이선스가 승인되었습니다!');
          persistResult('approved', '라이선스가 승인되었습니다!');
        }
      } else if (data.status === 'rejected') {
        if (pollRef.current) clearInterval(pollRef.current);
        localStorage.removeItem(LS_KEY);
        setPendingRequestId(null);
        const msg = data.note || '요청이 거절되었습니다. 관리자에게 문의하세요.';
        setLicenseStatus('rejected');
        setLicenseMessage(msg);
        persistResult('rejected', msg);
      }
      // pending → 다음 poll 대기
    } catch {
      // 네트워크 오류는 다음 poll에서 재시도
    }
  };

  // ── 외부 API ───────────────────────────────────────────────
  const startPolling = useCallback((requestId: string) => {
    localStorage.setItem(LS_KEY, requestId);
    localStorage.removeItem(LS_RESULT_KEY); // 이전 결과 제거
    setPendingRequestId(requestId);
    setLicenseStatus('pending');
    setLicenseMessage('관리자 승인을 기다리는 중입니다. 승인 시 알려드립니다.');
    beginPolling(requestId);
  }, [beginPolling]);

  const setApproved = useCallback((b64: string, exp: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    localStorage.removeItem(LS_KEY);
    setPendingRequestId(null);
    setLicenseStatus('approved');
    setLicenseB64(b64);
    setExpiresAt(exp);
    setLicenseMessage('라이선스가 승인되었습니다!');
    persistResult('approved', '라이선스가 승인되었습니다!', b64, exp);
  }, []);

  const retrySaveViaProxy = useCallback(async () => {
    if (!licenseB64) return;
    const saved = await saveViaProxy(licenseB64);
    if (saved) {
      setLicenseStatus('approved');
      setLicenseMessage('라이선스가 적용되었습니다!');
      persistResult('approved', '라이선스가 적용되었습니다!');
      localStorage.removeItem(LS_RESULT_KEY); // 성공 시 결과 제거
    } else {
      const msg = 'PTZ Proxy를 실행하여야 라이선스를 적용할 수 있습니다. PTZ Proxy를 실행하고 재시도하십시오.';
      setLicenseMessage(msg);
      persistResult('approved_no_proxy', msg, licenseB64, expiresAt);
    }
  }, [licenseB64, expiresAt]);

  const dismissNotification = useCallback(() => {
    // approved/rejected 알림만 dismiss (pending은 유지)
    if (licenseStatus === 'approved' || licenseStatus === 'approved_no_proxy' || licenseStatus === 'rejected') {
      setLicenseStatus('none');
      setLicenseMessage('');
      setLicenseB64('');
      localStorage.removeItem(LS_RESULT_KEY);
    }
  }, [licenseStatus]);

  return (
    <LicensePollingContext.Provider value={{
      pendingRequestId, licenseStatus, licenseMessage, licenseB64, expiresAt,
      dismissNotification, startPolling, setApproved, retrySaveViaProxy,
    }}>
      {children}
    </LicensePollingContext.Provider>
  );
}
