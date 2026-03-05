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
  action: 'pan' | 'tilt' | 'zoom' | 'focus' | 'stop' | 'preset' | 'custom';
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'near' | 'far';
  speed?: number;        // 0-100
  presetNumber?: number;
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
  type: 'connected' | 'command_sent' | 'camera_data' | 'disconnected' | 'error' | 'pong' | 'welcome';
  success?: boolean;
  message?: string;
  packet?: number[];
}
