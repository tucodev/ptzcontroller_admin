'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Loader2, Pencil, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { ProtocolType, CameraConfig } from '@/lib/types';

interface AddCameraModalProps {
  onClose: () => void;
  onSave:  () => void;
  editCamera?: CameraConfig | null;
}

export default function AddCameraModal({ onClose, onSave, editCamera }: AddCameraModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:         '',
    protocol:     'pelcod' as ProtocolType,
    host:         '',
    port:         4001,
    address:      1,
    username:     '',
    password:     '',
    proxyUrl:     'ws://localhost:9902',
    profileToken: '',
  });

  // ONVIF 프로필 탐색 상태
  const [onvifState, setOnvifState] = useState<{
    scanning:  boolean;
    profiles:  { token: string; name: string; hasPtz: boolean; resolution?: string }[];
    error:     string;
    done:      boolean;
  }>({ scanning: false, profiles: [], error: '', done: false });

  const isEditMode = !!editCamera;

  useEffect(() => {
    if (editCamera) {
      setForm({
        name:         editCamera.name         || '',
        protocol:     editCamera.protocol     || 'pelcod',
        host:         editCamera.host         || '',
        port:         editCamera.port         || 4001,
        address:      editCamera.address      || 1,
        username:     editCamera.username     || '',
        password:     editCamera.password     || '',
        proxyUrl:     editCamera.proxyUrl     || 'ws://localhost:9902',
        profileToken: editCamera.profileToken || '',
      });
    }
  }, [editCamera]);

  // protocol 변경 시 port 기본값 자동 조정
  const handleProtocolChange = (p: string) => {
    upd('protocol', p);
    if (p === 'onvif' && form.port === 4001) upd('port', 80);
    if ((p === 'pelcod' || p === 'ujin') && form.port === 80) upd('port', 4001);
    setOnvifState({ scanning: false, profiles: [], error: '', done: false });
  };

  // ONVIF GetProfiles 자동 탐색
  const scanOnvifProfiles = async () => {
    if (!form.host) {
      setOnvifState(s => ({ ...s, error: 'PTZ 카메라 IP를 먼저 입력하세요.', done: true }));
      return;
    }
    setOnvifState({ scanning: true, profiles: [], error: '', done: false });
    try {
      const res  = await fetch('/api/onvif/profiles', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          host:     form.host,
          port:     form.port,
          username: form.username,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success && data.profiles?.length > 0) {
        // PTZ 가능한 첫 번째 프로필을 자동 선택
        const best = data.profiles.find((p: { hasPtz: boolean }) => p.hasPtz) ?? data.profiles[0];
        upd('profileToken', best.token);
        setOnvifState({ scanning: false, profiles: data.profiles, error: data.error || '', done: true });
      } else {
        setOnvifState({
          scanning: false, profiles: [],
          error: data.error || '프로필을 찾을 수 없습니다.',
          done: true,
        });
      }
    } catch (err) {
      setOnvifState({
        scanning: false, profiles: [],
        error: (err as Error).message || '탐색 실패',
        done: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url    = isEditMode ? `/api/config/cameras?id=${editCamera?.id}` : '/api/config/cameras';
      const method = isEditMode ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, operationMode: 'proxy' }),
      });
      if (res?.ok) onSave();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const upd = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card text-card-foreground rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isEditMode ? 'bg-yellow-500/20' : 'bg-primary/20'}`}>
                {isEditMode
                  ? <Pencil className="w-5 h-5 text-yellow-500" />
                  : <Camera className="w-5 h-5 text-primary" />}
              </div>
              <h2 className="text-lg font-semibold">{isEditMode ? 'Edit Camera' : 'Add Camera'}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">

            {/* Name */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Camera Name</label>
              <input
                type="text" value={form.name} required
                onChange={(e) => upd('name', e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="e.g., 1번 카메라"
              />
            </div>

            {/* Protocol */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => handleProtocolChange(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="pelcod">PelcoD</option>
                <option value="ujin">ujin (PelcoD Variant)</option>
                <option value="onvif">ONVIF</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* PTZ Camera IP / Port */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  PTZ 카메라 IP
                  <span className="text-xs text-primary ml-1">(Proxy 기준)</span>
                </label>
                <input
                  type="text" value={form.host}
                  onChange={(e) => upd('host', e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Port</label>
                <input
                  type="number" min={1} max={65535} value={form.port}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 65535) upd('port', v);
                  }}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Device Address (PelcoD / ujin) */}
            {(form.protocol === 'pelcod' || form.protocol === 'ujin') && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Device Address (1-255)</label>
                <input
                  type="number" min="1" max="255" value={form.address}
                  onChange={(e) => upd('address', parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* ONVIF credentials + 자동탐색 */}
            {form.protocol === 'onvif' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Username</label>
                    <input
                      type="text" value={form.username}
                      onChange={(e) => upd('username', e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Password</label>
                    <input
                      type="password" value={form.password}
                      onChange={(e) => upd('password', e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Profile Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-muted-foreground">Profile Token</label>
                    <button
                      type="button"
                      onClick={scanOnvifProfiles}
                      disabled={onvifState.scanning}
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors disabled:opacity-50"
                    >
                      {onvifState.scanning
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> 탐색 중...</>
                        : <><Search className="w-3 h-3" /> 자동 탐색</>}
                    </button>
                  </div>

                  {/* 탐색 결과 — 프로필 목록 */}
                  {onvifState.profiles.length > 0 ? (
                    <div className="space-y-1">
                      {onvifState.profiles.map((p) => (
                        <label
                          key={p.token}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            form.profileToken === p.token
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-muted/30 hover:bg-muted/60'
                          }`}
                        >
                          <input
                            type="radio" name="profileToken" value={p.token}
                            checked={form.profileToken === p.token}
                            onChange={() => upd('profileToken', p.token)}
                            className="sr-only"
                          />
                          <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
                            form.profileToken === p.token ? 'text-primary' : 'text-muted-foreground/30'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              <span className="font-mono">{p.token}</span>
                              {p.resolution && <span>{p.resolution}</span>}
                              {p.hasPtz && <span className="text-primary">PTZ ✓</span>}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text" value={form.profileToken}
                      onChange={(e) => upd('profileToken', e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary font-mono text-sm"
                      placeholder="Profile_1 (자동 탐색 또는 직접 입력)"
                    />
                  )}

                  {/* 탐색 에러/안내 */}
                  {onvifState.done && onvifState.error && (
                    <div className="flex items-start gap-2 mt-2 text-xs text-yellow-500">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{onvifState.error}</span>
                    </div>
                  )}
                  {onvifState.done && !onvifState.error && (
                    <p className="text-xs text-green-500 mt-1">
                      ✓ PTZ 가능한 프로필이 자동 선택되었습니다.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Proxy WebSocket URL */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Proxy WebSocket URL
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-muted border border-r-0 border-border rounded-l-lg text-sm text-muted-foreground">
                  ws://
                </span>
                <input
                  type="text"
                  value={form.proxyUrl.replace(/^wss?:\/\//, '')}
                  onChange={(e) => {
                    const v = e.target.value.replace(/^(https?|wss?):\/\//, '');
                    upd('proxyUrl', v ? `ws://${v}` : '');
                  }}
                  className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-r-lg focus:ring-2 focus:ring-primary"
                  placeholder="localhost:9902"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                PTZ Proxy 가 실행 중인 PC 의 IP 와 포트 (예: 192.168.1.100:9902)
              </p>
            </div>

            {/* Proxy 모드 안내 */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium text-primary mb-1">Proxy 모드 연결 흐름</p>
              <p>브라우저 → PTZ Proxy (WebSocket) → PTZ 카메라 (TCP)</p>
              <p className="mt-1">PTZ Proxy 가 실행 중이어야 카메라에 연결할 수 있습니다.</p>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button" onClick={onClose}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading || !form.name}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Add Camera'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
