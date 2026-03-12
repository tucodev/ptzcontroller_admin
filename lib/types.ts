// PTZ Protocol Types
export type ProtocolType = 'pelcod' | 'ujin' | 'onvif' | 'custom';
export type OperationMode = 'proxy'; // Direct 모드 제거 — Proxy 전용

export interface CameraConfig {
  id: string;
  name: string;
  protocol: ProtocolType;
  operationMode: OperationMode;
  // PTZ 카메라 접속 정보 (ptz-proxy-electron → 카메라 TCP 연결에 사용)
  host?: string;
  port?: number;
  address?: number;    // PelcoD/ujin 장치 주소 (1-255)
  username?: string;     // ONVIF용
  password?: string;     // ONVIF용
  profileToken?: string; // ONVIF GetProfiles 자동탐색 결과 (예: Profile_1)
  // Proxy WebSocket 서버 주소
  proxyUrl?: string;   // e.g. ws://localhost:9902
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PTZCommand {
  // ── 공통 액션 (PelcoD + Ujin) ──
  action: 'pan' | 'tilt' | 'zoom' | 'focus' | 'stop'
        | 'pantilt'                                // 대각선 Pan+Tilt 동시 (8방향)
        | 'preset'                                 // Go To Preset (PelcoD:05h / Ujin:07h)
        | 'setPreset'                              // Set Preset (PelcoD:03h / Ujin:03h)
        | 'clearPreset'                            // Clear Preset (PelcoD:07h / Ujin:없음)
        | 'auxOn' | 'auxOff'                       // AUX 제어 (09h/0Bh)
        | 'reset'                                  // Reset (PelcoD:29h / Ujin:0Fh)
        // ── Ujin 전용 ──
        | 'gotoPosition'                           // Ujin 4축 절대이동 (71h)
        | 'requestPosition'                        // Ujin 4축 좌표 요청 (81h)
        // ── PelcoD 전용 ──
        | 'cameraOn' | 'cameraOff'                 // Camera On(88h) / Off(08h)
        | 'runGroup'                               // Run Group (23h)
        | 'runSwing'                               // Run Swing (1Bh)
        | 'cameraFunction'                         // AF/Iris/AGC/BLC/AWB (2Bh~33h)
        | 'setZoomSpeed' | 'setFocusSpeed'         // 25h/27h
        | 'setPosition'                            // PelcoD 축별 위치설정 (4Bh~5Fh)
        | 'queryPosition'                          // PelcoD 축별 위치조회 (51h~61h)
        | 'custom';

  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'near' | 'far'
            | 'upleft' | 'upright' | 'downleft' | 'downright';
  speed?: number;           // 0-100 (Pan/Tilt 속도)
  presetNumber?: number;    // 프리셋 번호
  auxId?: number;           // AUX 번호 (1~6)
  groupNumber?: number;     // Run Group 번호

  // ── Ujin 4축 좌표이동 (gotoPosition) ──
  position?: {
    pan:   number;  // 0~65535 (16bit)
    tilt:  number;
    zoom:  number;
    focus: number;
  };

  // ── PelcoD 카메라 기능 (cameraFunction) ──
  functionId?: 'autoFocus' | 'autoIris' | 'agc' | 'blc' | 'awb';
  functionValue?: number;   // 0=auto, 1=on, 2=off

  // ── PelcoD 축별 위치 (setPosition / queryPosition) ──
  axis?: 'pan' | 'tilt' | 'zoom' | 'focus';
  positionValue?: number;   // 16bit MSB/LSB

  // ── PelcoD 속도 레벨 (setZoomSpeed / setFocusSpeed) ──
  speedLevel?: number;      // 0-3

  customCommand?: string;
}

export interface PTZResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface PresetConfig {
  id: string;
  cameraId: string;
  number: number;
  name: string;
  description?: string;
}

export interface AppSettings {
  defaultProtocol: ProtocolType;
  proxyPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

// WebSocket Message Types (Proxy Mode)
export interface ProxyMessage {
  type: 'connect' | 'command' | 'disconnect' | 'ping';
  command?: PTZCommand & { address?: number; protocol?: string };
  config?: {
    host: string;
    port: number;
    protocol: string;
    address: number;
  };
}

export interface ProxyResponse {
  type: 'connected' | 'command_sent' | 'camera_data' | 'disconnected' | 'error' | 'pong' | 'welcome'
      | 'position_report';  // 좌표 응답 (Ujin:F0h / PelcoD:59h~63h)
  success?: boolean;
  message?: string;
  packet?: number[];
  // 좌표 응답 데이터 (부분 업데이트 가능 — PelcoD는 축별)
  position?: {
    pan:   number;
    tilt:  number;
    zoom:  number;
    focus: number;
  };
}
