'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ZoomIn, ZoomOut, Focus, Home, Square, Crosshair,
  Maximize2, Minimize2, Zap, MapPin, Sliders, Power,
  ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
  RotateCcw, Navigation, Timer,
} from 'lucide-react';
import { CameraConfig, PTZCommand } from '@/lib/types';

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────
interface PTZControlPanelProps {
  camera: CameraConfig;
  connected: boolean;
  onCommand: (command: PTZCommand) => void;
  position?: { pan: number; tilt: number; zoom: number; focus: number } | null;
  autoQueryEnabled?: boolean;
  autoQueryInterval?: number;
  onAutoQueryEnabledChange?: (enabled: boolean) => void;
  onAutoQueryIntervalChange?: (interval: number) => void;
}

// ─────────────────────────────────────────────────────────
// Custom Function 버튼 정의
// ─────────────────────────────────────────────────────────
interface CustomFunctionDef {
  key: string;
  label: string;
  title?: string;
  action: (connected: boolean, camera: CameraConfig, onCommand: (cmd: PTZCommand) => void) => void;
}

const CUSTOM_FUNCTIONS: CustomFunctionDef[] = [
  { key: 'f1', label: 'F1', title: '사용자 정의 기능 1',
    action: (c, cam) => console.log('[CustomFn] F1', c, cam.name) },
  { key: 'f2', label: 'F2', title: '사용자 정의 기능 2',
    action: (c, cam) => console.log('[CustomFn] F2', c, cam.name) },
  { key: 'f3', label: 'F3', title: '사용자 정의 기능 3',
    action: (c, cam) => console.log('[CustomFn] F3', c, cam.name) },
  { key: 'f4', label: 'F4', title: '사용자 정의 기능 4',
    action: (c, cam) => console.log('[CustomFn] F4', c, cam.name) },
  { key: 'f5', label: 'F5', title: '사용자 정의 기능 5',
    action: (c, cam) => console.log('[CustomFn] F5', c, cam.name) },
];

/** 뉴턴 크래들(진자 스윙) 아이콘 */
function SwingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {/* 상단 바 */}
      <line x1="3" y1="3" x2="21" y2="3" />
      {/* 줄 3개 (정지) */}
      <line x1="8" y1="3" x2="8" y2="15" />
      <line x1="12" y1="3" x2="12" y2="15" />
      {/* 스윙 줄 (우측으로 벌어진 진자) */}
      <line x1="16" y1="3" x2="20" y2="14" />
      {/* 공 3개 */}
      <circle cx="8" cy="17" r="2" />
      <circle cx="12" cy="17" r="2" />
      {/* 스윙 공 */}
      <circle cx="21" cy="16" r="2" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// 서브 컴포넌트 (메인 컴포넌트 바깥에 정의 → 리렌더 시 재생성 방지)
// ─────────────────────────────────────────────────────────

/** PTZ 연속 동작 버튼 (mouseDown/touchStart → 동작, mouseUp/touchEnd → Stop) */
function ControlButton({
  children, onAction, disabled, className = '', title,
}: {
  children: React.ReactNode;
  onAction: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onMouseDown={onAction}
      onTouchStart={onAction}
      disabled={disabled}
      title={title}
      className={`p-3 bg-muted hover:bg-primary/30 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-150 active:scale-90 active:bg-primary/50 active:shadow-inner active:ring-2 active:ring-primary/40 ${className}`}
    >
      {children}
    </button>
  );
}

/** 원샷 명령 버튼 (click 한 번) */
function ActionButton({
  children, onClick, disabled, className = '', title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-2 bg-muted hover:bg-primary/30 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-150 active:scale-90 active:bg-primary/50 active:shadow-inner active:ring-2 active:ring-primary/40 text-sm font-medium ${className}`}
    >
      {children}
    </button>
  );
}

/** 섹션 래퍼 — initial 애니메이션은 최초 마운트 시에만 실행됨 */
function Section({ children, title, icon: Icon, delay = 0 }: {
  children: React.ReactNode;
  title: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-muted/30 rounded-2xl p-5"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────
export default function PTZControlPanel({
  camera,
  connected,
  onCommand,
  position,
  autoQueryEnabled = false,
  autoQueryInterval = 1000,
  onAutoQueryEnabledChange,
  onAutoQueryIntervalChange,
}: PTZControlPanelProps) {
  const proto = (camera.protocol || 'pelcod').toLowerCase();
  const isPelcoD = proto === 'pelcod';
  const isUjin   = proto === 'ujin';

  // ─── State ─────────────────────────────────────────────
  const [speed, setSpeed]           = useState(50);
  const [zoomSpeed, setZoomSpeed]   = useState(50);
  const [focusSpeed, setFocusSpeed] = useState(50);
  const [presetInput, setPresetInput] = useState('1');
  const activeCommandRef = useRef<string | null>(null);

  // Position 입력
  const [posInput, setPosInput] = useState({ pan: 0, tilt: 0, zoom: 0, focus: 0 });

  // ─── 마우스/터치 릴리즈 시 Stop 전송 ─────────────────────
  const handleStop = useCallback(() => {
    if (activeCommandRef.current) {
      onCommand({ action: 'stop' });
      activeCommandRef.current = null;
    }
  }, [onCommand]);

  useEffect(() => {
    window.addEventListener('mouseup',  handleStop);
    window.addEventListener('touchend', handleStop);
    return () => {
      window.removeEventListener('mouseup',  handleStop);
      window.removeEventListener('touchend', handleStop);
    };
  }, [handleStop]);

  // ─── 핸들러 ────────────────────────────────────────────
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

  return (
    <div className="space-y-5">

      {/* ═══ Speed Controls ═══════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Pan/Tilt Speed</label>
          <input type="range" min="1" max="100" value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))} className="w-full" />
          <div className="text-center text-sm text-muted-foreground mt-1">{speed}%</div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Zoom Speed</label>
          <input type="range" min="1" max="100" value={zoomSpeed}
            onChange={(e) => setZoomSpeed(parseInt(e.target.value, 10))} className="w-full" />
          <div className="text-center text-sm text-muted-foreground mt-1">{zoomSpeed}%</div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Focus Speed</label>
          <input type="range" min="1" max="100" value={focusSpeed}
            onChange={(e) => setFocusSpeed(parseInt(e.target.value, 10))} className="w-full" />
          <div className="text-center text-sm text-muted-foreground mt-1">{focusSpeed}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* ═══ Pan/Tilt Joystick — 8방향 + Stop ═════════════ */}
        <Section title="Pan / Tilt Control" icon={Crosshair}>
          <div className="flex flex-col items-center gap-1">
            {/* 상단 행: ↖ ↑ ↗ */}
            <div className="flex items-center gap-1">
              <ControlButton onAction={() => handlePTZ('pantilt', 'upleft')} disabled={!connected} title="Up-Left">
                <ArrowUpLeft className="w-5 h-5" />
              </ControlButton>
              <ControlButton onAction={() => handlePTZ('tilt', 'up')} disabled={!connected} title="Up">
                <ArrowUp className="w-5 h-5" />
              </ControlButton>
              <ControlButton onAction={() => handlePTZ('pantilt', 'upright')} disabled={!connected} title="Up-Right">
                <ArrowUpRight className="w-5 h-5" />
              </ControlButton>
            </div>
            {/* 중간 행: ← ■ → */}
            <div className="flex items-center gap-1">
              <ControlButton onAction={() => handlePTZ('pan', 'left')} disabled={!connected} title="Left">
                <ArrowLeft className="w-5 h-5" />
              </ControlButton>
              <button
                onClick={() => onCommand({ action: 'stop' })}
                disabled={!connected}
                className="p-3 bg-destructive/50 hover:bg-destructive/70 hover:shadow-md disabled:opacity-50 rounded-xl transition-all duration-150 active:scale-90 active:bg-destructive active:shadow-inner"
                title="Stop"
              >
                <Square className="w-5 h-5" />
              </button>
              <ControlButton onAction={() => handlePTZ('pan', 'right')} disabled={!connected} title="Right">
                <ArrowRight className="w-5 h-5" />
              </ControlButton>
            </div>
            {/* 하단 행: ↙ ↓ ↘ */}
            <div className="flex items-center gap-1">
              <ControlButton onAction={() => handlePTZ('pantilt', 'downleft')} disabled={!connected} title="Down-Left">
                <ArrowDownLeft className="w-5 h-5" />
              </ControlButton>
              <ControlButton onAction={() => handlePTZ('tilt', 'down')} disabled={!connected} title="Down">
                <ArrowDown className="w-5 h-5" />
              </ControlButton>
              <ControlButton onAction={() => handlePTZ('pantilt', 'downright')} disabled={!connected} title="Down-Right">
                <ArrowDownRight className="w-5 h-5" />
              </ControlButton>
            </div>
          </div>
        </Section>

        {/* ═══ Zoom & Focus ═════════════════════════════════ */}
        <div className="space-y-4">
          <Section title="Zoom Control" icon={Maximize2} delay={0.05}>
            <div className="flex justify-center gap-3">
              <ControlButton onAction={() => handleZoom('out')} disabled={!connected} className="flex-1 max-w-[120px]">
                <div className="flex items-center justify-center gap-2">
                  <ZoomOut className="w-5 h-5" /><span className="text-sm">Out</span>
                </div>
              </ControlButton>
              <ControlButton onAction={() => handleZoom('in')} disabled={!connected}
                className="flex-1 max-w-[120px] bg-green-600/30 hover:bg-green-600/50">
                <div className="flex items-center justify-center gap-2">
                  <ZoomIn className="w-5 h-5" /><span className="text-sm">In</span>
                </div>
              </ControlButton>
            </div>
          </Section>

          <Section title="Focus Control" icon={Focus} delay={0.1}>
            <div className="flex justify-center gap-3">
              <ControlButton onAction={() => handleFocus('near')} disabled={!connected} className="flex-1 max-w-[120px]">
                <div className="flex items-center justify-center gap-2">
                  <Minimize2 className="w-5 h-5" /><span className="text-sm">Near</span>
                </div>
              </ControlButton>
              <ControlButton onAction={() => handleFocus('far')} disabled={!connected}
                className="flex-1 max-w-[120px] bg-purple-600/30 hover:bg-purple-600/50">
                <div className="flex items-center justify-center gap-2">
                  <Maximize2 className="w-5 h-5" /><span className="text-sm">Far</span>
                </div>
              </ControlButton>
            </div>
          </Section>
        </div>
      </div>

      {/* ═══ ① Presets ═══════════════════════════════════════ */}
      <Section title="Presets" icon={Home} delay={0.15}>
        <div className="flex flex-wrap gap-2 items-center">
          {/* 빠른 프리셋 1~6 */}
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              onClick={() => connected && onCommand({ action: 'preset', presetNumber: num })}
              disabled={!connected}
              className="w-11 h-11 bg-muted hover:bg-primary/50 hover:shadow-md disabled:opacity-50 rounded-lg transition-all duration-150 active:scale-90 active:bg-primary/70 active:shadow-inner font-medium text-sm"
            >
              {num}
            </button>
          ))}

          {/* 직접 번호 입력 + Go / Set / Clear */}
          <div className="flex items-center gap-2 ml-3">
            <input
              type="number" min="1" max="255" value={presetInput}
              onChange={(e) => setPresetInput(e.target.value)}
              className="w-16 px-2 py-2 bg-muted border border-border rounded-lg text-center text-sm"
              placeholder="#"
            />
            <ActionButton
              onClick={() => {
                const n = parseInt(presetInput, 10);
                if (connected && !isNaN(n) && n > 0) onCommand({ action: 'preset', presetNumber: n });
              }}
              disabled={!connected}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >Go</ActionButton>
            <ActionButton
              onClick={() => {
                const n = parseInt(presetInput, 10);
                if (connected && !isNaN(n) && n > 0) onCommand({ action: 'setPreset', presetNumber: n });
              }}
              disabled={!connected}
              className="bg-blue-600/30 hover:bg-blue-600/50"
            >Set</ActionButton>
            {/* Clear: PelcoD만 표시 (Ujin에는 Clear 없음) */}
            {isPelcoD && (
              <ActionButton
                onClick={() => {
                  const n = parseInt(presetInput, 10);
                  if (connected && !isNaN(n) && n > 0) onCommand({ action: 'clearPreset', presetNumber: n });
                }}
                disabled={!connected}
                className="bg-red-600/30 hover:bg-red-600/50"
              >Clear</ActionButton>
            )}
          </div>
        </div>
      </Section>

      {/* ═══ ② Position Monitor & Control ════════════════════ */}
      <Section title="Position Monitor" icon={MapPin} delay={0.2}>
        {/* 현재 위치 표시 */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {(['pan', 'tilt', 'zoom', 'focus'] as const).map((axis) => (
            <div key={axis} className="text-center">
              <div className="text-xs text-muted-foreground uppercase mb-1">{axis}</div>
              <div className="font-mono text-sm bg-muted rounded-lg px-2 py-1.5 tabular-nums">
                {String(position?.[axis] ?? 0).padStart(5, '0')}
              </div>
            </div>
          ))}
        </div>

        {/* 위치 입력 */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {(['pan', 'tilt', 'zoom', 'focus'] as const).map((axis) => (
            <div key={axis}>
              <label className="block text-xs text-muted-foreground mb-1 uppercase">{axis}</label>
              <input
                type="number" min="0" max="65535"
                value={posInput[axis]}
                onChange={(e) => setPosInput(prev => ({ ...prev, [axis]: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-2 py-1.5 bg-muted border border-border rounded-lg text-center text-sm font-mono"
              />
            </div>
          ))}
        </div>

        {/* 위치 제어 버튼 — 프로토콜별 */}
        <div className="flex flex-wrap gap-2">
          {isUjin && (
            <>
              <ActionButton
                onClick={() => connected && onCommand({ action: 'gotoPosition', position: posInput })}
                disabled={!connected}
                className="bg-green-600/30 hover:bg-green-600/50"
              >GoTo Position</ActionButton>
              <ActionButton
                onClick={() => connected && onCommand({ action: 'requestPosition' })}
                disabled={!connected}
                className="bg-blue-600/30 hover:bg-blue-600/50"
              >Query Position</ActionButton>
            </>
          )}
          {isPelcoD && (
            <>
              {(['pan', 'tilt', 'zoom', 'focus'] as const).map((axis) => (
                <ActionButton
                  key={axis}
                  onClick={() => connected && onCommand({
                    action: 'setPosition', axis, positionValue: posInput[axis],
                  })}
                  disabled={!connected}
                  className="bg-green-600/30 hover:bg-green-600/50"
                >Set {axis.charAt(0).toUpperCase() + axis.slice(1)}</ActionButton>
              ))}
              <ActionButton
                onClick={() => {
                  if (!connected) return;
                  // PelcoD: 4축 순차 조회
                  (['pan', 'tilt', 'zoom', 'focus'] as const).forEach((axis, i) => {
                    setTimeout(() => onCommand({ action: 'queryPosition', axis }), i * 100);
                  });
                }}
                disabled={!connected}
                className="bg-blue-600/30 hover:bg-blue-600/50"
              >Query All</ActionButton>
            </>
          )}
        </div>

        {/* Auto-Query 설정 */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
          <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoQueryEnabled}
              onChange={(e) => onAutoQueryEnabledChange?.(e.target.checked)}
              disabled={!connected}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm text-muted-foreground">Auto Query</span>
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="100" max="60000" step="100"
              value={autoQueryInterval}
              onChange={(e) => onAutoQueryIntervalChange?.(Math.max(100, Math.min(60000, parseInt(e.target.value, 10) || 1000)))}
              disabled={!connected}
              className="w-20 px-2 py-1 bg-muted border border-border rounded-lg text-center text-sm font-mono disabled:opacity-50"
            />
            <span className="text-xs text-muted-foreground">ms</span>
          </div>
          {autoQueryEnabled && connected && (
            <span className="text-xs text-green-500 animate-pulse">● Polling</span>
          )}
        </div>
      </Section>

      {/* ═══ ③ Device Control ════════════════════════════════ */}
      <Section title="Device Control" icon={Power} delay={0.25}>
        <div className="space-y-3">
          {/* AUX — PelcoD: 3열×2행, Ujin: 2열×1행 */}
          <div className={`grid gap-2 ${isPelcoD ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {(isPelcoD ? [1,2,3,4,5,6] : [1,2]).map((auxNum) => (
              <div key={auxNum} className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">AUX {auxNum}</span>
                <ActionButton onClick={() => connected && onCommand({ action: 'auxOn', auxId: auxNum })}
                  disabled={!connected} className="bg-green-600/30 hover:bg-green-600/50">On</ActionButton>
                <ActionButton onClick={() => connected && onCommand({ action: 'auxOff', auxId: auxNum })}
                  disabled={!connected} className="bg-red-600/30 hover:bg-red-600/50">Off</ActionButton>
              </div>
            ))}
          </div>

          {/* Run Group / Run Swing / Camera On/Off — PelcoD만 */}
          {isPelcoD && (
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => connected && onCommand({ action: 'runGroup', groupNumber: 1 })}
                disabled={!connected} className="bg-amber-600/30 hover:bg-amber-600/50">
                <span className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5" />Run Group</span>
              </ActionButton>
              <ActionButton onClick={() => connected && onCommand({ action: 'runSwing' })}
                disabled={!connected} className="bg-amber-600/30 hover:bg-amber-600/50">
                <span className="flex items-center gap-1"><SwingIcon className="w-4 h-4" />Run Swing</span>
              </ActionButton>
              <ActionButton onClick={() => connected && onCommand({ action: 'cameraOn' })}
                disabled={!connected} className="bg-green-600/30 hover:bg-green-600/50">Cam On</ActionButton>
              <ActionButton onClick={() => connected && onCommand({ action: 'cameraOff' })}
                disabled={!connected} className="bg-red-600/30 hover:bg-red-600/50">Cam Off</ActionButton>
            </div>
          )}

          {/* Init / Reset */}
          <div className="flex flex-wrap gap-2">
            <ActionButton
              onClick={() => {
                if (!connected) return;
                if (window.confirm('PTZ를 초기화(리셋)하시겠습니까?')) {
                  onCommand({ action: 'reset' });
                }
              }}
              disabled={!connected}
              className="bg-red-600/30 hover:bg-red-600/50"
            >
              <span className="flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Init / Reset</span>
            </ActionButton>
          </div>
        </div>
      </Section>

      {/* ═══ ④ Camera Settings (PelcoD 전용) ════════════════ */}
      {isPelcoD && (
        <Section title="Camera Settings" icon={Sliders} delay={0.3}>
          <div className="space-y-3">
            {/* AF / Iris / AGC / BLC / AWB — 2열 그리드 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {/* Auto Focus [Auto][On][Off] */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">Auto Focus</span>
                {[
                  { val: 0, text: 'Auto', cls: 'bg-blue-600/30 hover:bg-blue-600/50' },
                  { val: 1, text: 'On',   cls: 'bg-green-600/30 hover:bg-green-600/50' },
                  { val: 2, text: 'Off',  cls: 'bg-muted hover:bg-muted/80' },
                ].map(({ val, text, cls }) => (
                  <ActionButton key={val}
                    onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'autoFocus', functionValue: val })}
                    disabled={!connected} className={cls}
                  >{text}</ActionButton>
                ))}
              </div>
              {/* Auto Iris [Auto][On][Off] */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">Auto Iris</span>
                {[
                  { val: 0, text: 'Auto', cls: 'bg-blue-600/30 hover:bg-blue-600/50' },
                  { val: 1, text: 'On',   cls: 'bg-green-600/30 hover:bg-green-600/50' },
                  { val: 2, text: 'Off',  cls: 'bg-muted hover:bg-muted/80' },
                ].map(({ val, text, cls }) => (
                  <ActionButton key={val}
                    onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'autoIris', functionValue: val })}
                    disabled={!connected} className={cls}
                  >{text}</ActionButton>
                ))}
              </div>
              {/* Auto Gain Control [Auto][On][Off] */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">Auto Gain Control</span>
                {[
                  { val: 0, text: 'Auto', cls: 'bg-blue-600/30 hover:bg-blue-600/50' },
                  { val: 1, text: 'On',   cls: 'bg-green-600/30 hover:bg-green-600/50' },
                  { val: 2, text: 'Off',  cls: 'bg-muted hover:bg-muted/80' },
                ].map(({ val, text, cls }) => (
                  <ActionButton key={val}
                    onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'agc', functionValue: val })}
                    disabled={!connected} className={cls}
                  >{text}</ActionButton>
                ))}
              </div>
              {/* BL Compensation [On][Off] */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">BL Compensation</span>
                <ActionButton
                  onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'blc', functionValue: 1 })}
                  disabled={!connected} className="bg-green-600/30 hover:bg-green-600/50"
                >On</ActionButton>
                <ActionButton
                  onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'blc', functionValue: 2 })}
                  disabled={!connected} className="bg-muted hover:bg-muted/80"
                >Off</ActionButton>
              </div>
              {/* Auto White Balance [On][Off] */}
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">Auto White Balance</span>
                <ActionButton
                  onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'awb', functionValue: 1 })}
                  disabled={!connected} className="bg-green-600/30 hover:bg-green-600/50"
                >On</ActionButton>
                <ActionButton
                  onClick={() => connected && onCommand({ action: 'cameraFunction', functionId: 'awb', functionValue: 2 })}
                  disabled={!connected} className="bg-muted hover:bg-muted/80"
                >Off</ActionButton>
              </div>
            </div>

            {/* Zoom Speed / Focus Speed — 2열 그리드, 0~3 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">Zoom Speed</span>
                {[0, 1, 2, 3].map((lv) => (
                  <ActionButton key={lv}
                    onClick={() => connected && onCommand({ action: 'setZoomSpeed', speedLevel: lv })}
                    disabled={!connected} className="bg-muted hover:bg-muted/80 w-9"
                  >{lv}</ActionButton>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-[120px] shrink-0">Focus Speed</span>
                {[0, 1, 2, 3].map((lv) => (
                  <ActionButton key={lv}
                    onClick={() => connected && onCommand({ action: 'setFocusSpeed', speedLevel: lv })}
                    disabled={!connected} className="bg-muted hover:bg-muted/80 w-9"
                  >{lv}</ActionButton>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ═══ Custom Functions ════════════════════════════════ */}
      <Section title="Custom Functions" icon={Zap} delay={0.35}>
        <div className="grid grid-cols-5 gap-3">
          {CUSTOM_FUNCTIONS.map((fn) => (
            <button
              key={fn.key}
              title={fn.title}
              onClick={() => fn.action(connected, camera, onCommand)}
              className="h-11 bg-muted hover:bg-amber-500/30 hover:shadow-md border border-border hover:border-amber-500/50 rounded-lg transition-all duration-150 active:scale-90 active:bg-amber-500/50 active:shadow-inner font-medium text-sm"
            >
              {fn.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ═══ Camera Info ═════════════════════════════════════ */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Protocol: {camera.protocol?.toUpperCase() ?? 'Unknown'} | Mode: Proxy</p>
        {camera.host && <p>Host: {camera.host}:{camera.port ?? 'N/A'}</p>}
        {camera.address !== undefined && <p>Address: {camera.address}</p>}
      </div>
    </div>
  );
}
