'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Focus,
  Home,
  Square,
  Crosshair,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { CameraConfig, PTZCommand } from '@/lib/types';

interface PTZControlPanelProps {
  camera: CameraConfig;
  connected: boolean;
  onCommand: (command: PTZCommand) => void;
}

export default function PTZControlPanel({
  camera,
  connected,
  onCommand,
}: PTZControlPanelProps) {
  const [speed, setSpeed] = useState(50);
  const [zoomSpeed, setZoomSpeed] = useState(50);
  const [focusSpeed, setFocusSpeed] = useState(50);
  const [presetInput, setPresetInput] = useState('1');
  const activeCommandRef = useRef<string | null>(null);

  // Stop command when mouse/touch is released
  const handleStop = useCallback(() => {
    if (activeCommandRef.current) {
      onCommand({ action: 'stop' });
      activeCommandRef.current = null;
    }
  }, [onCommand]);

  // Add global event listeners for mouse up
  useEffect(() => {
    const handleGlobalUp = () => handleStop();
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [handleStop]);

  const handlePTZ = (action: PTZCommand['action'], direction?: PTZCommand['direction']) => {
    if (!connected) return;
    activeCommandRef.current = `${action}-${direction}`;
    onCommand({ action, direction, speed });
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!connected) return;
    activeCommandRef.current = `zoom-${direction}`;
    onCommand({ action: 'zoom', direction, speed: zoomSpeed });
  };

  const handleFocus = (direction: 'near' | 'far') => {
    if (!connected) return;
    activeCommandRef.current = `focus-${direction}`;
    onCommand({ action: 'focus', direction, speed: focusSpeed });
  };

  const handlePreset = () => {
    if (!connected) return;
    const num = parseInt(presetInput, 10);
    if (!isNaN(num) && num > 0) {
      onCommand({ action: 'preset', presetNumber: num });
    }
  };

  const ControlButton = ({
    children,
    onAction,
    disabled,
    className = '',
  }: {
    children: React.ReactNode;
    onAction: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      onMouseDown={onAction}
      onTouchStart={onAction}
      disabled={disabled}
      className={`p-4 bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all active:scale-95 ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Speed Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Pan/Tilt Speed</label>
          <input
            type="range"
            min="1"
            max="100"
            value={speed}
            onChange={(e) => setSpeed(parseInt(e?.target?.value ?? '50', 10))}
            className="w-full"
          />
          <div className="text-center text-sm text-muted-foreground mt-1">{speed}%</div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Zoom Speed</label>
          <input
            type="range"
            min="1"
            max="100"
            value={zoomSpeed}
            onChange={(e) => setZoomSpeed(parseInt(e?.target?.value ?? '50', 10))}
            className="w-full"
          />
          <div className="text-center text-sm text-muted-foreground mt-1">{zoomSpeed}%</div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Focus Speed</label>
          <input
            type="range"
            min="1"
            max="100"
            value={focusSpeed}
            onChange={(e) => setFocusSpeed(parseInt(e?.target?.value ?? '50', 10))}
            className="w-full"
          />
          <div className="text-center text-sm text-muted-foreground mt-1">{focusSpeed}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PTZ Joystick */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-muted/30 rounded-2xl p-6"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Crosshair className="w-4 h-4" />
            Pan / Tilt Control
          </h3>
          
          <div className="flex flex-col items-center gap-2">
            {/* Up */}
            <ControlButton
              onAction={() => handlePTZ('tilt', 'up')}
              disabled={!connected}
            >
              <ArrowUp className="w-6 h-6" />
            </ControlButton>

            <div className="flex items-center gap-2">
              {/* Left */}
              <ControlButton
                onAction={() => handlePTZ('pan', 'left')}
                disabled={!connected}
              >
                <ArrowLeft className="w-6 h-6" />
              </ControlButton>

              {/* Stop / Home */}
              <button
                onClick={() => onCommand({ action: 'stop' })}
                disabled={!connected}
                className="p-4 bg-destructive/50 hover:bg-destructive/70 disabled:opacity-50 rounded-xl transition-all"
              >
                <Square className="w-6 h-6" />
              </button>

              {/* Right */}
              <ControlButton
                onAction={() => handlePTZ('pan', 'right')}
                disabled={!connected}
              >
                <ArrowRight className="w-6 h-6" />
              </ControlButton>
            </div>

            {/* Down */}
            <ControlButton
              onAction={() => handlePTZ('tilt', 'down')}
              disabled={!connected}
            >
              <ArrowDown className="w-6 h-6" />
            </ControlButton>
          </div>
        </motion.div>

        {/* Zoom & Focus */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Zoom Control */}
          <div className="bg-muted/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              Zoom Control
            </h3>
            <div className="flex justify-center gap-4">
              <ControlButton
                onAction={() => handleZoom('out')}
                disabled={!connected}
                className="flex-1 max-w-[120px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <ZoomOut className="w-5 h-5" />
                  <span className="text-sm">Out</span>
                </div>
              </ControlButton>
              <ControlButton
                onAction={() => handleZoom('in')}
                disabled={!connected}
                className="flex-1 max-w-[120px] bg-green-600/30 hover:bg-green-600/50 dark:bg-green-600/30 dark:hover:bg-green-600/50"
              >
                <div className="flex items-center justify-center gap-2">
                  <ZoomIn className="w-5 h-5" />
                  <span className="text-sm">In</span>
                </div>
              </ControlButton>
            </div>
          </div>

          {/* Focus Control */}
          <div className="bg-muted/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Focus className="w-4 h-4" />
              Focus Control
            </h3>
            <div className="flex justify-center gap-4">
              <ControlButton
                onAction={() => handleFocus('near')}
                disabled={!connected}
                className="flex-1 max-w-[120px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <Minimize2 className="w-5 h-5" />
                  <span className="text-sm">Near</span>
                </div>
              </ControlButton>
              <ControlButton
                onAction={() => handleFocus('far')}
                disabled={!connected}
                className="flex-1 max-w-[120px] bg-purple-600/30 hover:bg-purple-600/50 dark:bg-purple-600/30 dark:hover:bg-purple-600/50"
              >
                <div className="flex items-center justify-center gap-2">
                  <Maximize2 className="w-5 h-5" />
                  <span className="text-sm">Far</span>
                </div>
              </ControlButton>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Presets */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-muted/30 rounded-2xl p-6"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
          <Home className="w-4 h-4" />
          Presets
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Quick presets */}
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              onClick={() => {
                if (connected) {
                  onCommand({ action: 'preset', presetNumber: num });
                }
              }}
              disabled={!connected}
              className="w-12 h-12 bg-muted hover:bg-primary/50 disabled:opacity-50 rounded-lg transition-all font-medium"
            >
              {num}
            </button>
          ))}
          
          {/* Custom preset input */}
          <div className="flex items-center gap-2 ml-4">
            <input
              type="number"
              min="1"
              max="255"
              value={presetInput}
              onChange={(e) => setPresetInput(e?.target?.value ?? '1')}
              className="w-20 px-3 py-2 bg-muted border border-border rounded-lg text-center"
              placeholder="#"
            />
            <button
              onClick={handlePreset}
              disabled={!connected}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 rounded-lg transition-all font-medium"
            >
              Go
            </button>
          </div>
        </div>
      </motion.div>

      {/* Custom Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-muted/30 rounded-2xl p-6"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
          <Square className="w-4 h-4" />
          Custom Functions
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              onClick={() => {
                // TODO: 커스텀 기능 구현
                console.log(`Custom button ${num} clicked`);
              }}
              className="h-12 bg-muted hover:bg-amber-500/30 border border-border hover:border-amber-500/50 rounded-lg transition-all font-medium text-sm"
            >
              F{num}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          사용자 정의 기능을 위한 버튼입니다. (추후 기능 추가 예정)
        </p>
      </motion.div>

      {/* Camera Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Protocol: {camera?.protocol?.toUpperCase?.() ?? 'Unknown'} | Mode: {camera?.operationMode === 'proxy' ? 'Proxy' : 'Direct'}</p>
        {camera?.host && <p>Host: {camera.host}:{camera?.port ?? 'N/A'}</p>}
        {camera?.address !== undefined && <p>Address: {camera.address}</p>}
      </div>
    </div>
  );
}
