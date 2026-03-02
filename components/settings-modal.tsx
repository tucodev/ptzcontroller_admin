'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Loader2, Save, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AppSettings } from '@/lib/types';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { theme: currentTheme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    defaultProtocol: 'pelcod',
    defaultOperationMode: 'direct',
    proxyPort: 9902,
    logLevel: 'info',
    theme: 'dark',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    // Sync settings theme with next-themes
    if (currentTheme && settings.theme !== currentTheme) {
      const validTheme = (currentTheme === 'light' || currentTheme === 'dark' || currentTheme === 'system') 
        ? currentTheme 
        : 'dark';
      setSettings(prev => ({ ...prev, theme: validTheme }));
    }
  }, [currentTheme, settings.theme]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/config/settings');
      const data = await res.json();
      if (data?.settings) {
        setSettings(data.settings);
        // Apply saved theme on load
        if (data.settings.theme) {
          setTheme(data.settings.theme);
        }
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      onClose();
    } catch (error) {
      console.error('Save settings error:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key: keyof AppSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    updateSettings('theme', newTheme);
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
          className="bg-card text-card-foreground rounded-2xl w-full max-w-md border border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Default Protocol */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Default Protocol</label>
                <select
                  value={settings?.defaultProtocol ?? 'pelcod'}
                  onChange={(e) => updateSettings('defaultProtocol', e?.target?.value ?? 'pelcod')}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="pelcod">PelcoD</option>
                  <option value="onvif">ONVIF</option>
                  <option value="ujin">ujin</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Default Operation Mode */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Default Operation Mode</label>
                <select
                  value={settings?.defaultOperationMode ?? 'direct'}
                  onChange={(e) => updateSettings('defaultOperationMode', e?.target?.value ?? 'direct')}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="direct">Direct (Mode 2)</option>
                  <option value="proxy">Proxy (Mode 3)</option>
                </select>
              </div>

              {/* Proxy Port */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Proxy WebSocket Port</label>
                <input
                  type="number"
                  value={settings?.proxyPort ?? 9902}
                  onChange={(e) => updateSettings('proxyPort', parseInt(e?.target?.value ?? '9902', 10))}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Log Level */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Log Level</label>
                <select
                  value={settings?.logLevel ?? 'info'}
                  onChange={(e) => updateSettings('logLevel', e?.target?.value ?? 'info')}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                >
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
                  {(['light', 'dark', 'system'] as const).map((themeOption) => (
                    <button
                      key={themeOption}
                      type="button"
                      onClick={() => handleThemeChange(themeOption)}
                      className={`px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                        currentTheme === themeOption
                          ? 'bg-primary/30 border-primary'
                          : 'bg-muted/30 border-border hover:bg-muted/50'
                      }`}
                    >
                      {themeOption === 'light' && <Sun className="w-4 h-4" />}
                      {themeOption === 'dark' && <Moon className="w-4 h-4" />}
                      {themeOption === 'system' && <Monitor className="w-4 h-4" />}
                      <span className="text-sm capitalize">{themeOption}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                >
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
