import { BaseProtocol } from './base-protocol';
import { PTZCommand, PTZResponse, CameraConfig } from '../types';
import net from 'net';

// ujin protocol - PelcoD variant with custom extensions
export class UjinProtocol extends BaseProtocol {
  private socket: net.Socket | null = null;
  private readonly SYNC_BYTE = 0xFF;
  private readonly UJIN_HEADER = 0xAA; // Custom ujin header

  constructor(config: CameraConfig) {
    super(config);
  }

  async connect(): Promise<PTZResponse> {
    return new Promise((resolve) => {
      try {
        const host = this.config?.host ?? 'localhost';
        const port = this.config?.port ?? 5001;

        this.socket = new net.Socket();
        
        this.socket.connect(port, host, () => {
          this.connected = true;
          resolve(this.buildResponse(true, `Connected to ujin device at ${host}:${port}`));
        });

        this.socket.on('error', (err) => {
          this.connected = false;
          resolve(this.buildResponse(false, `Connection error: ${err?.message ?? 'Unknown error'}`));
        });

        this.socket.on('close', () => {
          this.connected = false;
        });

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
            resolve(this.buildResponse(true, 'ujin command sent', { packet: packet?.map(b => b?.toString?.(16)?.padStart?.(2, '0') ?? '00') }));
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
    
    // ujin uses extended PelcoD with custom header
    let cmd1 = 0x00;
    let cmd2 = 0x00;
    let data1 = 0x00;
    let data2 = 0x00;
    let extCmd = 0x00; // ujin extension byte

    switch (command?.action) {
      case 'stop':
        cmd2 = 0x00;
        extCmd = 0x00;
        break;

      case 'pan':
        data1 = speed;
        if (command?.direction === 'left') {
          cmd2 = 0x04;
        } else if (command?.direction === 'right') {
          cmd2 = 0x02;
        }
        extCmd = 0x01; // ujin smooth pan mode
        break;

      case 'tilt':
        data2 = speed;
        if (command?.direction === 'up') {
          cmd2 = 0x08;
        } else if (command?.direction === 'down') {
          cmd2 = 0x10;
        }
        extCmd = 0x02; // ujin smooth tilt mode
        break;

      case 'zoom':
        if (command?.direction === 'in') {
          cmd2 = 0x20;
          extCmd = 0x10; // ujin zoom acceleration
        } else if (command?.direction === 'out') {
          cmd2 = 0x40;
          extCmd = 0x10;
        }
        break;

      case 'focus':
        if (command?.direction === 'near') {
          cmd1 = 0x01;
          extCmd = 0x20; // ujin auto-focus hint
        } else if (command?.direction === 'far') {
          cmd1 = 0x00;
          cmd2 = 0x80;
          extCmd = 0x20;
        }
        break;

      case 'preset':
        if (command?.presetNumber !== undefined) {
          cmd1 = 0x00;
          cmd2 = 0x07;
          data2 = command.presetNumber;
          extCmd = 0x40; // ujin fast preset mode
        }
        break;

      case 'custom':
        // ujin custom command support
        if (command?.customCommand) {
          const customBytes = this.parseCustomCommand(command.customCommand);
          if (customBytes) {
            return customBytes;
          }
        }
        return null;

      default:
        return null;
    }

    // Build ujin packet: UJIN_HEADER + SYNC + ADDR + CMD1 + CMD2 + DATA1 + DATA2 + EXT + CHECKSUM
    const packet = [this.UJIN_HEADER, this.SYNC_BYTE, address, cmd1, cmd2, data1, data2, extCmd];
    const checksum = packet.reduce((sum, byte) => sum + byte, 0) % 256;
    packet.push(checksum);

    return packet;
  }

  private parseCustomCommand(customCommand: string): number[] | null {
    try {
      // Parse hex string like "AA FF 01 00 02 20 00 00 XX"
      const bytes = customCommand?.split?.(' ')?.map(hex => parseInt(hex, 16)) ?? [];
      if (bytes?.length > 0 && bytes.every(b => !isNaN(b))) {
        return bytes;
      }
    } catch {
      return null;
    }
    return null;
  }

  // Generate packet without sending (for proxy mode)
  generatePacket(command: PTZCommand): number[] | null {
    return this.buildPacket(command);
  }
}
