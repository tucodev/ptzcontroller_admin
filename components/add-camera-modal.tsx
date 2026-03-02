'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Loader2, Pencil } from 'lucide-react';
import { ProtocolType, ConnectionType, OperationMode, CameraConfig } from '@/lib/types';

interface AddCameraModalProps {
  onClose: () => void;
  onSave: () => void;
  editCamera?: CameraConfig | null;
}

export default function AddCameraModal({ onClose, onSave, editCamera }: AddCameraModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    protocol: 'pelcod' as ProtocolType,
    connectionType: 'tcp' as ConnectionType,
    operationMode: 'direct' as OperationMode,
    host: '',
    port: 5000,
    address: 1,
    username: '',
    password: '',
    proxyUrl: '',
  });

  const isEditMode = !!editCamera;

  useEffect(() => {
    if (editCamera) {
      setForm({
        name: editCamera.name || '',
        protocol: editCamera.protocol || 'pelcod',
        connectionType: editCamera.connectionType || 'tcp',
        operationMode: editCamera.operationMode || 'direct',
        host: editCamera.host || '',
        port: editCamera.port || 5000,
        address: editCamera.address || 1,
        username: editCamera.username || '',
        password: editCamera.password || '',
        proxyUrl: editCamera.proxyUrl || '',
      });
    }
  }, [editCamera]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEditMode 
        ? `/api/config/cameras?id=${editCamera?.id}` 
        : '/api/config/cameras';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res?.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card text-card-foreground rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isEditMode ? 'bg-yellow-500/20' : 'bg-primary/20'}`}>
                {isEditMode ? (
                  <Pencil className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Camera className="w-5 h-5 text-primary" />
                )}
              </div>
              <h2 className="text-lg font-semibold">{isEditMode ? 'Edit Camera' : 'Add Camera'}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Camera Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e?.target?.value ?? '')}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="e.g., Main Camera"
                required
              />
            </div>

            {/* Protocol */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => updateForm('protocol', e?.target?.value ?? 'pelcod')}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="pelcod">PelcoD</option>
                <option value="onvif">ONVIF</option>
                <option value="ujin">ujin (PelcoD Variant)</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Operation Mode */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Operation Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateForm('operationMode', 'direct')}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    form.operationMode === 'direct'
                      ? 'bg-primary/30 border-primary'
                      : 'bg-muted/30 border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium">Direct</div>
                  <div className="text-xs text-muted-foreground">Server → PTZ</div>
                </button>
                <button
                  type="button"
                  onClick={() => updateForm('operationMode', 'proxy')}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    form.operationMode === 'proxy'
                      ? 'bg-primary/30 border-primary'
                      : 'bg-muted/30 border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium">Proxy</div>
                  <div className="text-xs text-muted-foreground">Browser → Proxy → PTZ</div>
                </button>
              </div>
            </div>

            {/* PTZ Camera Connection Settings - 모든 모드에서 필요 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  PTZ 카메라 IP
                  {form.operationMode === 'proxy' && (
                    <span className="text-xs text-primary ml-1">(Proxy 기준)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => updateForm('host', e?.target?.value ?? '')}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => updateForm('port', parseInt(e?.target?.value ?? '5000', 10))}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {(form.protocol === 'pelcod' || form.protocol === 'ujin') && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Device Address (1-255)</label>
                <input
                  type="number"
                  min="1"
                  max="255"
                  value={form.address}
                  onChange={(e) => updateForm('address', parseInt(e?.target?.value ?? '1', 10))}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {form.protocol === 'onvif' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => updateForm('username', e?.target?.value ?? '')}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateForm('password', e?.target?.value ?? '')}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Proxy Mode - WebSocket URL */}
            {form.operationMode === 'proxy' && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Proxy WebSocket URL</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-muted border border-r-0 border-border rounded-l-lg text-sm text-muted-foreground">
                    ws://
                  </span>
                  <input
                    type="text"
                    value={form.proxyUrl.replace(/^wss?:\/\//, '')}
                    onChange={(e) => {
                      const value = (e?.target?.value ?? '').replace(/^(https?|wss?):\/\//, '');
                      updateForm('proxyUrl', value ? `ws://${value}` : '');
                    }}
                    className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-r-lg focus:ring-2 focus:ring-primary"
                    placeholder="localhost:9902"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  PTZ Proxy가 실행 중인 PC의 IP와 포트 (예: 192.168.1.100:9902)
                </p>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !form.name}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Camera
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
