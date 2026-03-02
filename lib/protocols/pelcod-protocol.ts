import { BaseProtocol } from './base-protocol';
import { PTZCommand, PTZResponse, CameraConfig } from '../types';
import net from 'net';

export class PelcoDProtocol extends BaseProtocol {
  private socket: net.Socket | null = null;
  private readonly SYNC_BYTE = 0xFF;

  constructor(config: CameraConfig) {
    super(config);
  }

  async connect(): Promise<PTZResponse> {
    return new Promise((resolve) => {
      try {
        const host = this.config?.host ?? 'localhost';
        const port = this.config?.port ?? 5000;

        this.socket = new net.Socket();
        
        this.socket.connect(port, host, () => {
          this.connected = true;
          resolve(this.buildResponse(true, `Connected to ${host}:${port}`));
        });

        this.socket.on('error', (err) => {
          this.connected = false;
          resolve(this.buildResponse(false, `Connection error: ${err?.message ?? 'Unknown error'}`));
        });

        this.socket.on('close', () => {
          this.connected = false;
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!this.connected) {
            this.socket?.destroy?.();
            resolve(this.buildResponse(false, 'Connection timeout'));
          }
        }, 5000);
      } catch (error) {
        resolve(this.buildResponse(false, `Failed to connect: ${(error as Error)?.message ?? 'Unknown error'}`));
      }
    });
  }

  async disconnect(): Promise<PTZResponse> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.destroy();
        this.socket = null;
      }
      this.connected = false;
      resolve(this.buildResponse(true, 'Disconnected'));
    });
  }

  async sendCommand(command: PTZCommand): Promise<PTZResponse> {
    if (!this.connected || !this.socket) {
      return this.buildResponse(false, 'Not connected');
    }

    const packet = this.buildPacket(command);
    if (!packet) {
      return this.buildResponse(false, 'Invalid command');
    }

    return new Promise((resolve) => {
      try {
        this.socket?.write?.(Buffer.from(packet), (err) => {
          if (err) {
            resolve(this.buildResponse(false, `Send error: ${err?.message ?? 'Unknown error'}`));
          } else {
            resolve(this.buildResponse(true, 'Command sent', { packet: packet?.map(b => b?.toString?.(16)?.padStart?.(2, '0') ?? '00') }));
          }
        });
      } catch (error) {
        resolve(this.buildResponse(false, `Send failed: ${(error as Error)?.message ?? 'Unknown error'}`));
      }
    });
  }

  private buildPacket(command: PTZCommand): number[] | null {
    const address = this.config?.address ?? 1;
    const speed = this.speedToBytes(command?.speed ?? 50);
    
    let cmd1 = 0x00;
    let cmd2 = 0x00;
    let data1 = 0x00;
    let data2 = 0x00;

    switch (command?.action) {
      case 'stop':
        cmd2 = 0x00;
        break;

      case 'pan':
        data1 = speed; // Pan speed
        if (command?.direction === 'left') {
          cmd2 = 0x04;
        } else if (command?.direction === 'right') {
          cmd2 = 0x02;
        }
        break;

      case 'tilt':
        data2 = speed; // Tilt speed
        if (command?.direction === 'up') {
          cmd2 = 0x08;
        } else if (command?.direction === 'down') {
          cmd2 = 0x10;
        }
        break;

      case 'zoom':
        if (command?.direction === 'in') {
          cmd2 = 0x20;
        } else if (command?.direction === 'out') {
          cmd2 = 0x40;
        }
        break;

      case 'focus':
        if (command?.direction === 'near') {
          cmd1 = 0x01;
        } else if (command?.direction === 'far') {
          cmd1 = 0x00;
          cmd2 = 0x80;
        }
        break;

      case 'preset':
        if (command?.presetNumber !== undefined) {
          cmd1 = 0x00;
          cmd2 = 0x07; // Go to preset
          data2 = command.presetNumber;
        }
        break;

      default:
        return null;
    }

    // Build PelcoD packet: SYNC + ADDR + CMD1 + CMD2 + DATA1 + DATA2 + CHECKSUM
    const packet = [this.SYNC_BYTE, address, cmd1, cmd2, data1, data2];
    const checksum = (address + cmd1 + cmd2 + data1 + data2) % 256;
    packet.push(checksum);

    return packet;
  }

  // Generate packet without sending (for proxy mode)
  generatePacket(command: PTZCommand): number[] | null {
    return this.buildPacket(command);
  }
}
