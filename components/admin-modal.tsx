'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Users, Upload, Trash2, Plus, Shield, ShieldOff,
  Loader2, Check, AlertCircle, Download, RefreshCw,
  Eye, EyeOff, KeyRound, UserCog, FileDown, ShieldCheck,
  Cloud,
} from 'lucide-react';

interface AdminModalProps {
  onClose: () => void;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  role: string;
  approved: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
}

interface ProxyFile {
  filename: string;
  size: number;
  downloadUrl: string;
}

type Tab = 'users' | 'proxy';

export default function AdminModal({ onClose }: AdminModalProps) {
  const [tab, setTab] = useState<Tab>('users');

  // ── 사용자 관리 상태 ──────────────────────────
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 새 사용자 폼
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [showNewPw, setShowNewPw] = useState(false);

  // 편집 폼
  const [editName, setEditName] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPw, setShowEditPw] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── Proxy 파일 상태 ───────────────────────────
  const [proxyFiles, setProxyFiles] = useState<ProxyFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [fileMsg, setFileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud Download URL
  const [cloudDownloadUrl, setCloudDownloadUrl] = useState<string | null>(null);
  const [cloudUrlInput, setCloudUrlInput] = useState('');
  const [cloudUrlSaving, setCloudUrlSaving] = useState(false);

  // ── 초기 로드 ─────────────────────────────────
  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if (tab === 'proxy') fetchProxyFiles(); }, [tab]);

  // ── 사용자 API ────────────────────────────────
  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, organization: newOrg, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setUserMsg({ type: 'err', text: data.error ?? 'Failed' }); return; }
      setUserMsg({ type: 'ok', text: `User "${newEmail}" created.` });
      setShowAddUser(false);
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewOrg(''); setNewRole('user');
      fetchUsers();
    } catch {
      setUserMsg({ type: 'err', text: 'Network error' });
    }
  }

  function startEdit(u: UserRow) {
    setEditUser(u);
    setEditName(u.name ?? '');
    setEditOrg(u.organization ?? '');
    setEditRole(u.role);
    setEditPassword('');
  }

  async function handleSaveEdit() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const body: Record<string, string> = { id: editUser.id, name: editName, organization: editOrg, role: editRole };
      if (editPassword) body.password = editPassword;
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setUserMsg({ type: 'err', text: data.error ?? 'Failed' }); return; }
      setUserMsg({ type: 'ok', text: 'User updated.' });
      setEditUser(null);
      fetchUsers();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleApproved(u: UserRow) {
    const next = !u.approved;
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, approved: next }),
    });
    const data = await res.json();
    if (!res.ok) { setUserMsg({ type: 'err', text: data.error ?? 'Failed' }); return; }
    setUserMsg({ type: 'ok', text: `"${u.email}" ${next ? '승인됨' : '승인 취소됨'}.` });
    fetchUsers();
  }

  async function handleDeleteUser(u: UserRow) {
    if (!confirm(`Delete user "${u.email}"?`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    });
    const data = await res.json();
    if (!res.ok) { setUserMsg({ type: 'err', text: data.error ?? 'Failed' }); return; }
    setUserMsg({ type: 'ok', text: `User "${u.email}" deleted.` });
    fetchUsers();
  }

  async function handleResetPassword(u: UserRow) {
    if (!confirm(`"${u.email}"에게 임시 비밀번호를 이메일로 발송하시겠습니까?`)) return;
    setUserMsg(null);
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUserMsg({ type: 'err', text: data.error ?? '비밀번호 리셋 실패' });
      return;
    }
    setUserMsg({ type: 'ok', text: data.message || `${u.email}로 임시 비밀번호 발송 완료` });
  }

  // ── Proxy 파일 API ────────────────────────────
  async function fetchProxyFiles() {
    setFilesLoading(true);
    try {
      const res = await fetch('/api/admin/proxy-file');
      const data = await res.json();
      if (res.ok) {
        setProxyFiles(data.files ?? []);
        setCloudDownloadUrl(data.cloudDownloadUrl ?? null);
        setCloudUrlInput(data.cloudDownloadUrl ?? '');
      }
    } finally {
      setFilesLoading(false);
    }
  }

  async function saveCloudUrl() {
    setCloudUrlSaving(true);
    setFileMsg(null);
    try {
      const res = await fetch('/api/admin/proxy-file', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudDownloadUrl: cloudUrlInput.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setFileMsg({ type: 'err', text: data.error ?? 'Failed' }); return; }
      setCloudDownloadUrl(data.cloudDownloadUrl ?? null);
      setFileMsg({ type: 'ok', text: 'Cloud Download URL 저장됨.' });
    } finally {
      setCloudUrlSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);
    setFileMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/proxy-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setFileMsg({ type: 'err', text: data.error ?? 'Upload failed' }); return; }
      setFileMsg({ type: 'ok', text: `"${data.filename}" uploaded successfully.` });
      fetchProxyFiles();
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteFile(filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;
    const res = await fetch('/api/admin/proxy-file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    if (!res.ok) { setFileMsg({ type: 'err', text: data.error ?? 'Failed' }); return; }
    setFileMsg({ type: 'ok', text: `"${filename}" deleted.` });
    fetchProxyFiles();
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // ── 렌더 ──────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold">관리자 설정</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {([['users', Users, '사용자 관리'], ['proxy', FileDown, 'Proxy 파일']] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-6">

            {/* ── 사용자 관리 탭 ── */}
            {tab === 'users' && (
              <div className="space-y-4">
                {/* 메시지 */}
                {userMsg && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${userMsg.type === 'ok' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {userMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {userMsg.text}
                    <button onClick={() => setUserMsg(null)} className="ml-auto"><X className="w-3 h-3" /></button>
                  </div>
                )}

                {/* 사용자 목록 헤더 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{users.length}명의 사용자</span>
                  <div className="flex gap-2">
                    <button onClick={fetchUsers} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { setShowAddUser(true); setEditUser(null); }}
                      className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" /> 사용자 추가
                    </button>
                  </div>
                </div>

                {/* 사용자 추가 폼 */}
                <AnimatePresence>
                  {showAddUser && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleAddUser}
                      className="bg-muted/40 border border-border rounded-lg p-4 space-y-3 overflow-hidden"
                    >
                      <h3 className="text-sm font-semibold flex items-center gap-2"><UserCog className="w-4 h-4" /> 새 사용자</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">이메일 *</label>
                          <input required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                            type="email" placeholder="user@example.com"
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">이름 *</label>
                          <input required value={newName} onChange={e => setNewName(e.target.value)}
                            placeholder="홍길동"
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">회사/소속 *</label>
                          <input required value={newOrg} onChange={e => setNewOrg(e.target.value)}
                            placeholder="(주)예시회사"
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div className="relative">
                          <label className="text-xs text-muted-foreground">비밀번호 *</label>
                          <input required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            type={showNewPw ? 'text' : 'password'} placeholder="••••••••"
                            className="w-full mt-1 px-3 py-2 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                          <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-7 text-muted-foreground">
                            {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">권한</label>
                          <select value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="user">일반 사용자</option>
                            <option value="admin">관리자</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={() => setShowAddUser(false)}
                          className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors">취소</button>
                        <button type="submit"
                          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm transition-colors">생성</button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* 편집 폼 */}
                <AnimatePresence>
                  {editUser && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="bg-muted/40 border border-primary/30 rounded-lg p-4 space-y-3 overflow-hidden"
                    >
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" /> 편집: {editUser.email}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">이름</label>
                          <input value={editName} onChange={e => setEditName(e.target.value)}
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">회사/소속</label>
                          <input value={editOrg} onChange={e => setEditOrg(e.target.value)}
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">권한</label>
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="user">일반 사용자</option>
                            <option value="admin">관리자</option>
                          </select>
                        </div>
                        <div className="relative col-span-2">
                          <label className="text-xs text-muted-foreground">새 비밀번호 (변경 시만 입력)</label>
                          <input value={editPassword} onChange={e => setEditPassword(e.target.value)}
                            type={showEditPw ? 'text' : 'password'} placeholder="변경하지 않으려면 비워두세요"
                            className="w-full mt-1 px-3 py-2 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                          <button type="button" onClick={() => setShowEditPw(p => !p)} className="absolute right-3 top-7 text-muted-foreground">
                            {showEditPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button onClick={() => setEditUser(null)}
                          className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors">취소</button>
                        <button onClick={handleSaveEdit} disabled={editSaving}
                          className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm transition-colors disabled:opacity-50">
                          {editSaving && <Loader2 className="w-3 h-3 animate-spin" />} 저장
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 사용자 목록 */}
                {usersLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-2">
                    {users.map(u => (
                      <div key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${editUser?.id === u.id ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'}`}>
                        <div className={`p-1.5 rounded-md ${u.role === 'admin' ? 'bg-amber-500/20' : 'bg-muted'}`}>
                          {u.role === 'admin' ? <Shield className="w-4 h-4 text-amber-500" /> : <ShieldOff className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.name ?? '-'} · {u.organization ?? '-'} · {u.role === 'admin' ? '관리자' : '일반'}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            최근 로그인: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                            {' · '}로그인 횟수: {u.loginCount ?? 0}회
                          </p>
                        </div>
                        {/* PTZ 허가 상태 뱃지 */}
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.approved
                              ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                          title={u.approved ? 'PTZ 허가됨' : 'PTZ 미허가'}
                        >
                          {u.approved
                            ? <ShieldCheck className="w-3 h-3" />
                            : <ShieldOff className="w-3 h-3" />}
                          <span className="hidden sm:inline">{u.approved ? '허가' : '미허가'}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleToggleApproved(u)}
                            className={`p-1.5 rounded-md transition-colors text-xs ${
                              u.approved
                                ? 'hover:bg-destructive/10 text-green-500 hover:text-destructive'
                                : 'hover:bg-green-500/10 text-muted-foreground hover:text-green-500'
                            }`}
                            title={u.approved ? '승인 취소' : 'PTZ 허가'}
                          >
                            {u.approved ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleResetPassword(u)}
                            className="p-1.5 hover:bg-amber-500/10 rounded-md transition-colors text-muted-foreground hover:text-amber-500"
                            title="비밀번호 리셋 (이메일 발송)">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button onClick={() => startEdit(u)}
                            className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                            <UserCog className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteUser(u)}
                            className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Proxy 파일 탭 ── */}
            {tab === 'proxy' && (
              <div className="space-y-4">
                {fileMsg && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${fileMsg.type === 'ok' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {fileMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {fileMsg.text}
                    <button onClick={() => setFileMsg(null)} className="ml-auto"><X className="w-3 h-3" /></button>
                  </div>
                )}

                {/* 안내 문구 */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 space-y-1">
                  <p className="font-medium">📦 PTZ Proxy 배포 파일 관리</p>
                  <p className="text-xs text-blue-400/80">
                    업로드한 파일은 proxy 연결 실패 시 팝업에서 &apos;실행 파일 다운로드&apos;로 제공됩니다.<br />
                    <span className="font-mono">.exe, .zip, .msi, .dmg, .sh, .bat, .appimage</span> 허용
                  </p>
                </div>

                {/* Cloud Download URL */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-medium">Cloud Download URL</h3>
                    {cloudDownloadUrl && (
                      <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full">설정됨</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    외부 다운로드 링크 (GitHub Releases, CDN 등). 설정 시 다운로드 팝업에 &apos;Cloud Download&apos; 버튼이 표시됩니다.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={cloudUrlInput}
                      onChange={(e) => setCloudUrlInput(e.target.value)}
                      placeholder="https://github.com/.../releases/latest"
                      className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    />
                    <button
                      onClick={saveCloudUrl}
                      disabled={cloudUrlSaving}
                      className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {cloudUrlSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      저장
                    </button>
                  </div>
                  {cloudDownloadUrl && (
                    <p className="text-xs text-sky-400/70 font-mono truncate">현재: {cloudDownloadUrl}</p>
                  )}
                </div>

                {/* 업로드 영역 */}
                <div
                  className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept=".exe,.zip,.msi,.dmg,.sh,.bat,.appimage"
                    onChange={handleFileUpload} />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">{uploadProgress}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Upload className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">클릭하여 파일 업로드</p>
                        <p className="text-xs text-muted-foreground mt-1">ptz-proxy-setup.exe, ptz-proxy.zip 등</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 파일 목록 */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">업로드된 파일</h3>
                  <button onClick={fetchProxyFiles} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {filesLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : proxyFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">업로드된 파일이 없습니다</p>
                    <p className="text-xs mt-1">파일을 업로드하면 사용자 다운로드 팝업에 자동으로 표시됩니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {proxyFiles.map(f => (
                      <div key={f.filename} className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-muted/40 border border-border rounded-lg transition-colors">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <FileDown className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium font-mono truncate">{f.filename}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                        </div>
                        <a href={f.downloadUrl} download
                          className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => handleDeleteFile(f.filename)}
                          className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 현재 다운로드 팝업 상태 요약 */}
                {(proxyFiles.length > 0 || cloudDownloadUrl) && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-1">
                    <p className="text-xs text-green-400 font-medium">✅ 현재 다운로드 팝업에 표시될 항목:</p>
                    {cloudDownloadUrl && (
                      <p className="text-xs text-sky-400/80 font-mono">
                        ☁️ Cloud Download → <span className="underline truncate">{cloudDownloadUrl}</span>
                      </p>
                    )}
                    {proxyFiles.map(f => (
                      <p key={f.filename} className="text-xs text-green-400/80 font-mono">
                        📦 실행 파일 다운로드 → {f.filename} ({formatBytes(f.size)})
                      </p>
                    ))}
                    {proxyFiles.length === 0 && (
                      <p className="text-xs text-yellow-400/80 font-mono">
                        ⏳ 실행 파일 다운로드 → 설치파일 준비중
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
