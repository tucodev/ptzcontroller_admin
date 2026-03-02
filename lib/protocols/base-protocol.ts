import { PTZCommand, PTZResponse, CameraConfig } from '../types';

export abstract class BaseProtocol {
  protected config: CameraConfig;
  protected connected: boolean = false;

  constructor(config: CameraConfig) {
    this.config = config;
  }

  abstract connect(): Promise<PTZResponse>;
  abstract disconnect(): Promise<PTZResponse>;
  abstract sendCommand(command: PTZCommand): Promise<PTZResponse>;
  
  isConnected(): boolean {
    return this.connected;
  }

  getConfig(): CameraConfig {
    return this.config;
  }

  // Common helper to build response
  protected buildResponse(success: boolean, message?: string, data?: unknown): PTZResponse {
    return { success, message, data };
  }

  // Calculate speed byte from percentage (0-100 to 0x00-0x3F for PelcoD)
  protected speedToBytes(speed: number, maxValue: number = 0x3F): number {
    const normalized = Math.max(0, Math.min(100, speed ?? 50));
    return Math.round((normalized / 100) * maxValue);
  }
}
