// PTZ Protocol Types
export type ProtocolType = 'pelcod' | 'onvif' | 'ujin' | 'custom';
export type ConnectionType = 'tcp' | 'serial' | 'http';
export type OperationMode = 'direct' | 'proxy';

export interface CameraConfig {
  id: string;
  name: string;
  protocol: ProtocolType;
  connectionType: ConnectionType;
  operationMode: OperationMode;
  host?: string;
  port?: number;
  serialPort?: string;
  baudRate?: number;
  address?: number; // For PelcoD addressing
  username?: string;
  password?: string;
  proxyUrl?: string; // For Mode 3
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PTZCommand {
  action: 'pan' | 'tilt' | 'zoom' | 'focus' | 'stop' | 'preset' | 'custom';
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'near' | 'far';
  speed?: number; // 0-100
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
  defaultOperationMode: OperationMode;
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

// WebSocket Message Types for Proxy Mode
export interface ProxyMessage {
  type: 'connect' | 'command' | 'disconnect' | 'status';
  cameraId?: string;
  command?: PTZCommand;
  connectionConfig?: Partial<CameraConfig>;
}

export interface ProxyResponse {
  type: 'connected' | 'response' | 'disconnected' | 'error';
  success: boolean;
  message?: string;
  data?: unknown;
}
