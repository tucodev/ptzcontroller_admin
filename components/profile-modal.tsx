'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Save, Eye, EyeOff, Loader2,
  CheckCircle, AlertCircle, KeyRound, ChevronDown, ChevronUp,
} from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { data: session, update } = useSession();

  // 피드백 메시지
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwMsg,      setPwMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 프로필 필드
  const [name,         setName]         = useState('');
  const [organization, setOrganization] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // 비밀번호 변경 필드
  const [showPwSection,  setShowPwSection]  = useState(false);
  const [currentPw,      setCurrentPw]      = useState('');
  const [newPw,          setNewPw]          = useState('');
  const [confirmPw,      setConfirmPw]      = useState('');
  const [showCurrentPw,  setShowCurrentPw]  = useState(false);
  const [showNewPw,      setShowNewPw]      = useState(false);
  const [pwLoading,      setPwLoading]      = useState(false);

  // 세션에서 현재 값 초기화
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? '');
      setOrganization((session.user as { organization?: string }).organization ?? '');
    }
  }, [session]);

  // ── 프로필 저장 ───────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/user/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, organization }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: 'err', text: data.error ?? '저장 실패' });
        return;
      }
      // 세션 토큰 즉시 갱신 (이름/소속이 헤더에 바로 반영됨)
      await update();
      setProfileMsg({ type: 'ok', text: '프로필이 저장되었습니다.' });
    } catch {
      setProfileMsg({ type: 'err', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setProfileLoading(false);
    }
  };

  // ── 비밀번호 변경 ─────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ type: 'err', text: '모든 비밀번호 필드를 입력하세요.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ type: 'err', text: '비밀번호는 최소 6자 이상이어야 합니다.' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ type: 'err', text: data.error ?? '변경 실패' });
        return;
      }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowPwSection(false);
      setPwMsg({ type: 'ok', text: '비밀번호가 변경되었습니다.' });
    } catch {
      setPwMsg({ type: 'err', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setPwLoading(false);
    }
  };

  const email   = session?.user?.email ?? '';
  const role    = (session?.user as { role?: string })?.role ?? 'user';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card text-card-foreground rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">내 계정</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-5">

            {/* 이메일 (읽기 전용) */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">이메일 (변경 불가)</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground">
                <span className="flex-1">{email}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  role === 'admin'
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {role === 'admin' ? 'Admin' : 'User'}
                </span>
              </div>
            </div>

            {/* ── 프로필 정보 ──────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">프로필</h3>

              {/* 피드백 */}
              {profileMsg && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                  profileMsg.type === 'ok'
                    ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                  {profileMsg.type === 'ok'
                    ? <CheckCircle className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {profileMsg.text}
                </div>
              )}

              <div>
                <label className="block text-sm text-muted-foreground mb-1">이름</label>
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  placeholder="표시 이름 입력"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1">소속</label>
                <input
                  type="text" value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  placeholder="소속 또는 부서명 (선택)"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={profileLoading || !name.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 rounded-lg transition-colors text-sm font-medium"
              >
                {profileLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />}
                프로필 저장
              </button>
            </div>

            <div className="border-t border-border" />

            {/* ── 비밀번호 변경 ─────────────────────────────── */}
            <div className="space-y-3">
              {/* 토글 헤더 */}
              <button
                onClick={() => { setShowPwSection(p => !p); setPwMsg(null); }}
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  비밀번호 변경
                </div>
                {showPwSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* 비밀번호 피드백 */}
              {pwMsg && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                  pwMsg.type === 'ok'
                    ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                  {pwMsg.type === 'ok'
                    ? <CheckCircle className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {pwMsg.text}
                </div>
              )}

              {showPwSection && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  {/* 현재 비밀번호 */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">현재 비밀번호</label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        className="w-full px-3 py-2 pr-10 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(p => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* 새 비밀번호 */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">새 비밀번호</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="w-full px-3 py-2 pr-10 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder="6자 이상"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(p => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* 새 비밀번호 확인 */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    {pwLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <KeyRound className="w-4 h-4" />}
                    비밀번호 변경
                  </button>
                </motion.div>
              )}
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
