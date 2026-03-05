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
  Zap,
} from 'lucide-react';
import { CameraConfig, PTZCommand } from '@/lib/types';

interface PTZControlPanelProps {
  camera: CameraConfig;
  connected: boolean;
  onCommand: (command: PTZCommand) => void;
}

// ─────────────────────────────────────────────────────────
// Custom Function 버튼 정의
//   추후 이 배열에 항목을 추가하면 UI 에 버튼이 자동 생성됨
//   각 항목의 action 함수에 실제 기능을 구현할 것
//
// TODO: 각 버튼의 구체적 동작 구현 필요
//   - onvif 프리셋 이름 조회
//   - 자동 포커스(AF) 트리거
//   - 와이퍼 제어
//   - 조명 제어
//   - 기타 장비 특화 기능
// ─────────────────────────────────────────────────────────
interface CustomFunctionDef {
  key: string;       // 버튼 고유 키
  label: string;     // 버튼 표시 라벨 (F1, F2 …)
  title?: string;    // 툴팁 텍스트
  /** 버튼 클릭 시 실행할 함수 */
  // TODO: 구현 시 (connected: boolean, camera: CameraConfig, onCommand: ...) 을 인자로 받도록 수정
  action: (connected: boolean, camera: CameraConfig, onCommand: (cmd: PTZCommand) => void) => void;
}

const CUSTOM_FUNCTIONS: CustomFunctionDef[] = [
  {
    key: 'f1',
    label: 'F1',
    title: '사용자 정의 기능 1',
    action: (connected, camera, _onCommand) => {
      // TODO: F1 기능 구현
      //   예시: 자동 포커스 트리거
      //   if (connected) onCommand({ action: 'focus', direction: 'near', speed: 100 });
      console.log('[CustomFn] F1 clicked, connected:', connected, 'camera:', camera.name);
    },
  },
  {
    key: 'f2',
    label: 'F2',
    title: '사용자 정의 기능 2',
    action: (connected, camera, _onCommand) => {
      // TODO: F2 기능 구현
      console.log('[CustomFn] F2 clicked, connected:', connected, 'camera:', camera.name);
    },
  },
  {
    key: 'f3',
    label: 'F3',
    title: '사용자 정의 기능 3',
    action: (connected, camera, _onCommand) => {
      // TODO: F3 기능 구현
      console.log('[CustomFn] F3 clicked, connected:', connected, 'camera:', camera.name);
    },
  },
  {
    key: 'f4',
    label: 'F4',
    title: '사용자 정의 기능 4',
    action: (connected, camera, _onCommand) => {
      // TODO: F4 기능 구현
      console.log('[CustomFn] F4 clicked, connected:', connected, 'camera:', camera.name);
    },
  },
  {
    key: 'f5',
    label: 'F5',
    title: '사용자 정의 기능 5',
    action: (connected, camera, _onCommand) => {
      // TODO: F5 기능 구현
      console.log('[CustomFn] F5 clicked, connected:', connected, 'camera:', camera.name);
    },
  },
];

export default function PTZControlPanel({
  camera,
  connected,
  onCommand,
}: PTZControlPanelProps) {
  const [speed, setSpeed]           = useState(50);
  const [zoomSpeed, setZoomSpeed]   = useState(50);
  const [focusSpeed, setFocusSpeed] = useState(50);
  const [presetInput, setPresetInput] = useState('1');
  const activeCommandRef = useRef<string | null>(null);

  // ─── 마우스/터치 릴리즈 시 Stop 전송 ─────────────────────
  const handleStop = useCallback(() => {
    if (activeCommandRef.current) {
      onCommand({ action: 'stop' });
      activeCommandRef.current = null;
    }
  }, [onCommand]);

  // window 전체에 mouseup/touchend 리스너 등록
  // (버튼 밖에서 손을 떼도 stop 이 전송되도록)
  useEffect(() => {
    window.addEventListener('mouseup',  handleStop);
    window.addEventListener('touchend', handleStop);
    return () => {
      window.removeEventListener('mouseup',  handleStop);
      window.removeEventListener('touchend', handleStop);
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

  // ─── 공통 컨트롤 버튼 컴포넌트 ───────────────────────────
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
            type="range" min="1" max="100" value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="text-center text-sm text-muted-foreground mt-1">{speed}%</div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Zoom Speed</label>
          <input
            type="range" min="1" max="100" value={zoomSpeed}
            onChange={(e) => setZoomSpeed(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="text-center text-sm text-muted-foreground mt-1">{zoomSpeed}%</div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Focus Speed</label>
          <input
            type="range" min="1" max="100" value={focusSpeed}
            onChange={(e) => setFocusSpeed(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="text-center text-sm text-muted-foreground mt-1">{focusSpeed}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pan / Tilt Joystick */}
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
            <ControlButton onAction={() => handlePTZ('tilt', 'up')} disabled={!connected}>
              <ArrowUp className="w-6 h-6" />
            </ControlButton>

            <div className="flex items-center gap-2">
              <ControlButton onAction={() => handlePTZ('pan', 'left')} disabled={!connected}>
                <ArrowLeft className="w-6 h-6" />
              </ControlButton>

              {/* Stop 버튼 */}
              <button
                onClick={() => onCommand({ action: 'stop' })}
                disabled={!connected}
                className="p-4 bg-destructive/50 hover:bg-destructive/70 disabled:opacity-50 rounded-xl transition-all"
              >
                <Square className="w-6 h-6" />
              </button>

              <ControlButton onAction={() => handlePTZ('pan', 'right')} disabled={!connected}>
                <ArrowRight className="w-6 h-6" />
              </ControlButton>
            </div>

            <ControlButton onAction={() => handlePTZ('tilt', 'down')} disabled={!connected}>
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
                onAction={() => handleZoom('out')} disabled={!connected}
                className="flex-1 max-w-[120px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <ZoomOut className="w-5 h-5" /><span className="text-sm">Out</span>
                </div>
              </ControlButton>
              <ControlButton
                onAction={() => handleZoom('in')} disabled={!connected}
                className="flex-1 max-w-[120px] bg-green-600/30 hover:bg-green-600/50"
              >
                <div className="flex items-center justify-center gap-2">
                  <ZoomIn className="w-5 h-5" /><span className="text-sm">In</span>
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
                onAction={() => handleFocus('near')} disabled={!connected}
                className="flex-1 max-w-[120px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <Minimize2 className="w-5 h-5" /><span className="text-sm">Near</span>
                </div>
              </ControlButton>
              <ControlButton
                onAction={() => handleFocus('far')} disabled={!connected}
                className="flex-1 max-w-[120px] bg-purple-600/30 hover:bg-purple-600/50"
              >
                <div className="flex items-center justify-center gap-2">
                  <Maximize2 className="w-5 h-5" /><span className="text-sm">Far</span>
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
          {/* 빠른 프리셋 버튼 1~6 */}
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              onClick={() => connected && onCommand({ action: 'preset', presetNumber: num })}
              disabled={!connected}
              className="w-12 h-12 bg-muted hover:bg-primary/50 disabled:opacity-50 rounded-lg transition-all font-medium"
            >
              {num}
            </button>
          ))}

          {/* 직접 번호 입력 프리셋 */}
          <div className="flex items-center gap-2 ml-4">
            <input
              type="number" min="1" max="255" value={presetInput}
              onChange={(e) => setPresetInput(e.target.value)}
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

      {/* ─── Custom Functions ───────────────────────────────────
          추후 기능 추가 예정 버튼 영역
          CUSTOM_FUNCTIONS 배열에 항목 추가 후 action 함수를 구현할 것
          ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-muted/30 rounded-2xl p-6"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Custom Functions
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {CUSTOM_FUNCTIONS.map((fn) => (
            <button
              key={fn.key}
              title={fn.title}
              onClick={() => fn.action(connected, camera, onCommand)}
              className="h-12 bg-muted hover:bg-amber-500/30 border border-border hover:border-amber-500/50 rounded-lg transition-all font-medium text-sm"
            >
              {fn.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {/* TODO: 각 버튼 라벨/툴팁은 CUSTOM_FUNCTIONS 배열에서 관리 */}
          사용자 정의 기능 버튼 — CUSTOM_FUNCTIONS 배열에 action 구현 후 활성화
        </p>
      </motion.div>

      {/* Camera Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Protocol: {camera.protocol?.toUpperCase() ?? 'Unknown'} | Mode: Proxy</p>
        {camera.host && <p>Host: {camera.host}:{camera.port ?? 'N/A'}</p>}
        {camera.address !== undefined && <p>Address: {camera.address}</p>}
      </div>
    </div>
  );
}
