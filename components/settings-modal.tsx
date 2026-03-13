'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Settings, Loader2, Save, Moon, Sun, Monitor,
  ShieldCheck, ShieldAlert, ShieldOff, Clock, Send, RefreshCw,
  Upload, Download, AlertTriangle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { AppSettings } from '@/lib/types';

interface SettingsModalProps {
  onClose: () => void;
}

type LicenseRequestStatus =
  | 'idle'        // 라이선스 없음
  | 'gathering'   // HW 정보 + 사용자 정보 수집 중
  | 'confirming'  // 요청 정보 확인/편집 다이얼로그 표시 중
  | 'requesting'  // 요청 전송 중
  | 'pending'     // 승인 대기 중
  | 'approved'    // 라이선스 보유
  | 'rejected'    // 거절됨
  | 'error';      // 오류

interface LicenseState {
  status:     LicenseRequestStatus;
  requestId:  string;
  message:    string;
  expiresAt:  string;
  machineId:  string;
  licenseB64: string; // 방금 발급받은 라이선스 데이터 (다운로드/폴더저장용)
}

// 확인 다이얼로그에서 보여줄 수집된 정보
interface ConfirmInfo {
  email:      string;
  machineIds: string[];
  fromProxy:  boolean; // true: ptz-proxy에서 수집, false: 서버 측 HW ID 사용
}

const POLL_MS = 30_000;          // 폴링 간격 30초
const LS_KEY  = 'ptz_lic_reqid'; // localStorage: requestId 저장 키


export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const { theme: currentTheme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    defaultProtocol: 'pelcod',
    proxyPort:       9902,
    logLevel:        'info',
    theme:           'system',
  });

  // ── 라이선스 상태 ─────────────────────────────────────────
  const [lic, setLic] = useState<LicenseState>({
    status: 'idle', requestId: '', message: '',
    expiresAt: '', machineId: '', licenseB64: '',
  });
  const [savingFile, setSavingFile] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Proxy 실행 상태 (idle 상태 버튼 제어) ─────────────────
  // 'checking': 확인 중 | 'running': 실행 중 | 'stopped': 미실행
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'running' | 'stopped'>('checking');

  // ── 확인 다이얼로그 상태 ──────────────────────────────────
  const [confirmInfo,  setConfirmInfo]  = useState<ConfirmInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrg,  setEditOrg]  = useState('');

  useEffect(() => {
    fetchSettings();
    checkExistingLicense();
  }, []);

  // 언마운트 시 폴링 정리
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (currentTheme && settings.theme !== currentTheme) {
      const v = (['light','dark','system'] as const).includes(currentTheme as 'light'|'dark'|'system')
        ? currentTheme as 'light'|'dark'|'system' : 'dark';
      setSettings(prev => ({ ...prev, theme: v }));
    }
  }, [currentTheme, settings.theme]);

  // ── 기존 라이선스 / 진행 중 요청 복원 ──────────────────────
  const checkExistingLicense = async () => {
    try {
      // 1. 로컬에 저장된 라이선스 파일 확인
      const res  = await fetch('/api/license/verify');
      const data = await res.json();
      if (data.valid) {
        setLic(prev => ({ ...prev, status: 'approved', expiresAt: data.expiresAt }));
        return;
      }
      // 2. 이전에 저장한 requestId 로 폴링 복원
      const savedId = localStorage.getItem(LS_KEY);
      if (savedId) {
        setLic(prev => ({ ...prev, status: 'pending', requestId: savedId,
          message: '관리자 승인을 기다리는 중입니다...' }));
        startPolling(savedId);
      }
    } catch { /* 오프라인 환경 등에서 무시 */ }
  };

  // ── 폴링 ─────────────────────────────────────────────────
  const startPolling = (requestId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => doPoll(requestId), POLL_MS);
  };

  const doPoll = async (requestId: string) => {
    try {
      const res  = await fetch(`/api/license/poll?requestId=${requestId}`);
      const data = await res.json();

      if (data.status === 'approved') {
        clearInterval(pollRef.current!);
        localStorage.removeItem(LS_KEY);
        // 승인 즉시 공유 경로에 자동 저장
        if (data.license) await autoSaveLicense(data.license);
        setLic(prev => ({ ...prev, status: 'approved',
          expiresAt: data.expiresAt, licenseB64: data.license ?? '',
          message: '라이선스의 발급이 완료되었습니다!' }));
      } else if (data.status === 'rejected') {
        clearInterval(pollRef.current!);
        localStorage.removeItem(LS_KEY);
        setLic(prev => ({ ...prev, status: 'rejected',
          message: data.note || '요청이 거절되었습니다. 관리자에게 문의하세요.' }));
      }
    } catch { /* 네트워크 오류는 다음 폴링 때 재시도 */ }
  };

  // ── 1단계: 정보 수집 후 확인 다이얼로그 표시 ─────────────
  // 버튼 클릭 시 처음 진입하는 함수
  const handleInitiateRequest = async () => {
    setLic(prev => ({ ...prev, status: 'gathering', message: '' }));

    // 1) ptz-proxy-electron 에서 HW 정보 수집 (필수)
    //    wmic 등 시스템 명령 첫 호출 시 느릴 수 있으므로 타임아웃 10초
    let machineIds: string[] = [];
    let fromProxy = false;
    try {
      const hwRes = await fetch(
        `http://localhost:${settings.proxyPort}/hw-info`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (hwRes.ok) {
        const hw = await hwRes.json();
        if (Array.isArray(hw.machineIds) && hw.machineIds.length > 0) {
          machineIds = hw.machineIds as string[];
          fromProxy = true;
          setProxyStatus('running'); // HW 응답 성공 → proxy 실행 확인
        }
      }
    } catch { /* proxy 미실행 */ }

    // proxy에서 HW 정보를 얻지 못하면 진행 불가 → idle 복귀
    // (서버 측 HW ID로 발급하면 엉뚱한 머신에 라이선스가 발급됨)
    if (!fromProxy) {
      setProxyStatus('stopped');
      setLic(prev => ({ ...prev, status: 'idle' }));
      return;
    }

    // 2) 세션에서 사용자 정보 수집
    let email = '';
    let name  = '';
    let org   = '';
    try {
      const s = await (await fetch('/api/auth/session')).json();
      email = s?.user?.email ?? '';
      name  = s?.user?.name  ?? '';
      org   = (s?.user as { organization?: string })?.organization ?? '';
    } catch { /* ignore */ }

    // 3) 확인 다이얼로그 표시 (항상 fromProxy=true 보장)
    setConfirmInfo({ email, machineIds, fromProxy });
    setEditName(name);
    setEditOrg(org);
    setLic(prev => ({ ...prev, status: 'confirming' }));
  };

  // ── 2단계: 확인 후 실제 API 호출 ─────────────────────────
  // 사용자가 다이얼로그에서 정보를 확인/수정하고 확인 버튼을 눌렀을 때
  const handleSubmitRequest = async (
    name: string,
    org: string,
    mIds: string[],
    fromProxy: boolean,
  ) => {
    setConfirmInfo(null);
    setLic(prev => ({ ...prev, status: 'requesting', message: '' }));

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        org:  org.trim(),
      };
      // proxy에서 수집한 머신 ID가 있을 때만 body에 포함
      if (fromProxy && mIds.length > 0) {
        body.machineIds = mIds;
      }

      const res  = await fetch('/api/license/request-online', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setLic(prev => ({ ...prev, status: 'error', message: data.error ?? '요청 실패' }));
        return;
      }

      if (data.status === 'approved') {
        // 발급 즉시 공유 경로에 자동 저장
        if (data.license) await autoSaveLicense(data.license);
        setLic(prev => ({ ...prev, status: 'approved',
          expiresAt: data.expiresAt, machineId: data.machineId ?? '',
          licenseB64: data.license ?? '', message: '라이선스가 즉시 발급되었습니다!' }));
      } else {
        const reqId = data.requestId ?? '';
        localStorage.setItem(LS_KEY, reqId);
        setLic(prev => ({ ...prev, status: 'pending', requestId: reqId,
          machineId: data.machineId ?? '',
          message: data.message ?? '관리자 승인을 기다리는 중입니다...' }));
        startPolling(reqId);
      }
    } catch {
      setLic(prev => ({ ...prev, status: 'error', message: '라이선스 서버에 연결할 수 없습니다' }));
    }
  };

  // ── 공유 경로 자동 저장 (내부 헬퍼 — 발급 즉시 호출) ────────
  const autoSaveLicense = async (license: string): Promise<void> => {
    try {
      await fetch('/api/license/save-shared', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ license }),
      });
    } catch { /* 자동 저장 실패는 무시 — 수동 저장 버튼으로 재시도 가능 */ }
  };

  // ── 수동 저장 버튼 핸들러 ─────────────────────────────────
  const handleSaveToFolder = async () => {
    const b64 = lic.licenseB64;
    if (!b64) return;
    setSavingFile(true);
    try {
      const res  = await fetch('/api/license/save-shared', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ license: b64 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('저장 완료!\n\n라이선스가 저장되었습니다.\nptzcontroller를 재시작하면 자동으로 인식됩니다.');
      } else {
        alert('저장 실패: ' + (data.error ?? '알 수 없는 오류'));
      }
    } catch (e: unknown) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingFile(false);
    }
  };

  // ── 파일 업로드 → 서버(로컬 Desktop)에 저장 ─────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingFile(true);
    try {
      const formData = new FormData();
      formData.append('license', file);
      const res  = await fetch('/api/license/verify', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setLic(prev => ({ ...prev, status: 'approved', expiresAt: data.expiresAt,
          licenseB64: '', message: '라이선스가 등록되었습니다!' }));
      } else {
        alert('라이선스 오류: ' + (data.error ?? '알 수 없는 오류'));
      }
    } catch {
      alert('파일 업로드 중 오류가 발생했습니다');
    } finally {
      setSavingFile(false);
      e.target.value = '';
    }
  };

  // ── 오프라인 .ptzreq 요청 파일 다운로드 ──────────────────
  const handleDownloadRequest = () => {
    try {
      const a = document.createElement('a');
      a.href = '/api/license/request';
      a.download = 'ptzcontroller.ptzreq';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('요청 파일 다운로드에 실패했습니다.');
    }
  };

  // ── Proxy 실행 여부 빠른 확인 ────────────────────────────
  const checkProxyStatus = async (port?: number) => {
    const proxyPort = port ?? settings.proxyPort;
    setProxyStatus('checking');
    try {
      const res = await fetch(`http://localhost:${proxyPort}/health`,
        { signal: AbortSignal.timeout(3_000) });
      setProxyStatus(res.ok ? 'running' : 'stopped');
    } catch {
      setProxyStatus('stopped');
    }
  };

  // ── 설정 조회 / 저장 ──────────────────────────────────────
  const fetchSettings = async () => {
    try {
      const res  = await fetch('/api/config/settings');
      const data = await res.json();
      if (data?.settings) {
        // 실제 적용 중인 테마(currentTheme)를 우선 사용한다.
        // API가 반환하는 theme은 저장 시점에 따라 기본값 "dark"일 수 있으므로
        // localStorage/next-themes가 관리하는 currentTheme이 항상 정확하다.
        const activeTheme = (currentTheme as 'light'|'dark'|'system') || data.settings.theme;
        setSettings({ ...data.settings, theme: activeTheme });
        // 설정 로드 후 proxy 상태 확인
        checkProxyStatus(data.settings.proxyPort);
      }
    } catch (e) {
      console.error('Fetch settings error:', e);
      setProxyStatus('stopped');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        console.error('Save settings failed:', res.status);
        alert('설정 저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      onClose();
    } catch (e) {
      console.error('Save settings error:', e);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key: keyof AppSettings, value: string | number) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const handleThemeChange = (t: 'light'|'dark'|'system') => {
    setTheme(t);
    updateSettings('theme', t);
    // 테마는 Save 버튼을 기다리지 않고 즉시 서버에 저장
    // (dashboard 재진입 시 기본값 "dark"로 덮어씌워지는 것을 방지)
    fetch('/api/config/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, theme: t }),
    }).catch(() => {});
    // Desktop: Electron 설정(standalone/data/settings.json)에도 저장
    // → 재시작 시 preload.js가 이 값을 읽어 localStorage에 주입함
    if (typeof window !== 'undefined' && (window as any).electronAPI?.saveSettings) {
      (window as any).electronAPI.saveSettings({ theme: t });
    }
  };

  // ── 라이선스 섹션 UI ──────────────────────────────────────
  const renderLicenseSection = () => {
    const { status, message, expiresAt, machineId, requestId, licenseB64 } = lic;

    // ── gathering: 정보 수집 중 ──────────────────────────────
    if (status === 'gathering') return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>요청 정보를 수집하는 중...</span>
      </div>
    );

    // ── confirming: 확인/수정 다이얼로그 ─────────────────────
    // 이 상태에 도달할 때는 항상 fromProxy=true (handleInitiateRequest에서 보장)
    if (status === 'confirming' && confirmInfo) return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-foreground">📋 발급 요청 정보 확인</p>

        {/* PTZ Proxy 수집 성공 표시 */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <p className="text-xs text-green-600 dark:text-green-400">
            PTZ Proxy에서 머신 ID {confirmInfo.machineIds.length}개를 수집했습니다
          </p>
        </div>

        {/* 이메일 (읽기 전용) */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">이메일 <span className="text-muted-foreground/60">(자동)</span></label>
          <div className="px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground">
            {confirmInfo.email || '(세션 없음)'}
          </div>
        </div>

        {/* 이름 (편집 가능) */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">이름</label>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* 회사/소속 (편집 가능, 필수) */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            회사/소속 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editOrg}
            onChange={e => setEditOrg(e.target.value)}
            placeholder="회사 또는 소속을 입력하세요 (필수)"
            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* 머신 ID 목록 (항상 proxy에서 수집) */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            수집된 머신 ID
          </label>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {confirmInfo.machineIds.map((id, i) => (
              <div key={i} className="px-2 py-1 bg-muted/30 border border-border/50 rounded text-xs font-mono text-muted-foreground truncate">
                {i === 0 && <span className="text-primary mr-1">★</span>}{id}
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              setConfirmInfo(null);
              setLic(prev => ({ ...prev, status: 'idle' }));
            }}
            className="flex-1 py-2 bg-muted hover:bg-muted/80 text-sm rounded-lg transition-colors">
            취소
          </button>
          <button
            onClick={() => handleSubmitRequest(editName, editOrg, confirmInfo.machineIds, confirmInfo.fromProxy)}
            disabled={!editOrg.trim()}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-600/90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            발급 요청
          </button>
        </div>
      </div>
    );

    // ── approved ─────────────────────────────────────────────
    if (status === 'approved') return (
      <div className="space-y-3">
        {/* 상태 표시 */}
        <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-500">오프라인 라이선스 보유 중</p>
            {expiresAt && <p className="text-xs text-muted-foreground mt-0.5">만료일: {expiresAt.slice(0,10)}</p>}
          </div>
        </div>

        {/* 방금 발급받은 경우 저장 버튼 표시 */}
        {licenseB64 && (
          <div className="space-y-2">
            <p className="text-xs text-green-500 font-medium">
              ✓ 라이선스가 자동으로 발급되었습니다. 라이선스 저장에 실패한 경우 아래 버튼을 누르세요.
            </p>
            <button onClick={handleSaveToFolder} disabled={savingFile}
              className="w-full py-2 bg-blue-600 hover:bg-blue-600/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              {savingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              실패시 강제 라이선스 저장
            </button>
          </div>
        )}

        {/* 라이선스 갱신/재발급용 요청 파일 다운로드 */}
        <button onClick={handleDownloadRequest}
          className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <Download className="w-4 h-4" />
          갱신 요청 파일 다운로드 (.ptzreq)
        </button>

        {/* 파일 직접 등록 (항상 표시) */}
        <label className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
          {savingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          라이선스 파일 직접 등록 (.ptzlic)
          <input type="file" accept=".ptzlic" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    );

    // ── pending ───────────────────────────────────────────────
    if (status === 'pending') return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-500">승인 대기 중</p>
            <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
            {machineId && <p className="text-xs font-mono text-muted-foreground mt-1 truncate">Machine ID: {machineId}</p>}
          </div>
          <button onClick={() => doPoll(requestId)} title="지금 확인"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center">30초마다 자동으로 확인합니다</p>

        {/* 새 요청 버튼 (확인 다이얼로그 경유) */}
        <button onClick={handleInitiateRequest}
          className="w-full py-2 bg-blue-600 hover:bg-blue-600/90 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          새로 요청하기
        </button>

        {/* 오프라인 재요청을 위한 .ptzreq 재다운로드 */}
        <button onClick={handleDownloadRequest}
          className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <Download className="w-4 h-4" />
          요청 파일 재다운로드 (.ptzreq)
        </button>

        {/* 관리자가 수동 발급한 .ptzlic 직접 등록 */}
        <label className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4" />
          라이선스 파일 직접 등록 (.ptzlic)
          <input type="file" accept=".ptzlic" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    );

    // ── rejected ─────────────────────────────────────────────
    if (status === 'rejected') return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">요청이 거절되었습니다</p>
            <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
          </div>
        </div>
        {/* 재요청도 확인 다이얼로그 경유 */}
        <button onClick={handleInitiateRequest}
          className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />재요청
        </button>
      </div>
    );

    // ── requesting ────────────────────────────────────────────
    if (status === 'requesting') return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /><span>요청 전송 중...</span>
      </div>
    );

    // ── error ─────────────────────────────────────────────────
    if (status === 'error') return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
          <ShieldOff className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{message}</p>
        </div>
        <button onClick={handleInitiateRequest}
          className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" />다시 시도
        </button>
      </div>
    );

    // ── idle ──────────────────────────────────────────────────
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          오프라인 환경을 대비해 미리 라이선스를 발급받으세요.
          요청 후 관리자 승인 시 자동으로 저장됩니다.
        </p>

        {/* 온라인 요청 — PTZ Proxy 실행 상태에 따라 조건부 표시 */}
        {proxyStatus === 'checking' && (
          <div className="flex items-center gap-2 py-2.5 text-sm text-muted-foreground justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>PTZ Proxy 상태 확인 중...</span>
          </div>
        )}

        {proxyStatus === 'running' && (
          <button onClick={handleInitiateRequest}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-600/90 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />온라인 라이선스 발급 요청
          </button>
        )}

        {proxyStatus === 'stopped' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  PTZ Proxy가 실행되지 않았습니다
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  온라인 발급을 하려면 PTZ Proxy (포트 {settings.proxyPort})를 먼저 실행하세요.
                </p>
              </div>
            </div>
            <button onClick={() => checkProxyStatus()}
              className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Proxy 재확인
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">또는 (인터넷 연결 없을 때)</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* 오프라인 요청 파일 다운로드 */}
        <div className="space-y-1.5">
          <button onClick={handleDownloadRequest}
            className="w-full py-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            요청 파일 다운로드 (.ptzreq)
          </button>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            다운로드 후 관리자에게 전달 → 발급받은 .ptzlic 파일을 아래에 등록하세요
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">또는</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* .ptzlic 파일 직접 등록 */}
        <label className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4" />
          라이선스 파일 직접 등록 (.ptzlic)
          <input type="file" accept=".ptzlic" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}
          className="bg-card text-card-foreground rounded-2xl w-full max-w-md border border-border">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg"><Settings className="w-5 h-5 text-primary" /></div>
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">

              {/* Protocol */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Default Protocol</label>
                <select value={settings?.defaultProtocol ?? 'pelcod'}
                  onChange={e => updateSettings('defaultProtocol', e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="pelcod">PelcoD</option>
                  <option value="onvif">ONVIF</option>
                  <option value="ujin">ujin</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Operation Mode — Proxy 전용 (고정) */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Operation Mode</label>
                <div className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-primary font-medium">Proxy Mode</span>
                  <span>— 브라우저 → PTZ Proxy → 카메라</span>
                </div>
              </div>

              {/* Proxy Port */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Proxy WebSocket Port</label>
                <input type="number" min={1024} max={65535} value={settings?.proxyPort ?? 9902}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1024 && v <= 65535) updateSettings('proxyPort', v);
                  }}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary" />
              </div>

              {/* Log Level */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Log Level</label>
                <select value={settings?.logLevel ?? 'info'}
                  onChange={e => updateSettings('logLevel', e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light','dark','system'] as const).map(t => (
                    <button key={t} type="button" onClick={() => handleThemeChange(t)}
                      className={`px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                        currentTheme === t ? 'bg-primary/30 border-primary' : 'bg-muted/30 border-border hover:bg-muted/50'
                      }`}>
                      {t === 'light' && <Sun className="w-4 h-4" />}
                      {t === 'dark'  && <Moon className="w-4 h-4" />}
                      {t === 'system' && <Monitor className="w-4 h-4" />}
                      <span className="text-sm capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 오프라인 라이선스 섹션 ──────────────────── */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">오프라인 라이선스</span>
                </div>
                {renderLicenseSection()}
              </div>

              {/* Save */}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
