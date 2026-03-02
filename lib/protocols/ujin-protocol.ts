import { BaseProtocol } from './base-protocol';
import { PTZCommand, PTZResponse, CameraConfig } from '../types';
import net from 'net';

// ujin protocol — PelcoD 변형 (커스텀 헤더 + extCmd 확장 바이트 포함)
// 패킷 구조: [UJIN_HEADER(AA)] [SYNC(FF)] [ADDR] [CMD1] [CMD2] [DATA1] [DATA2] [EXT] [CHECKSUM]
export class UjinProtocol extends BaseProtocol {
  private socket: net.Socket | null = null;
  private readonly SYNC_BYTE   = 0xFF;
  private readonly UJIN_HEADER = 0xAA; // ujin 장비 식별 헤더

  constructor(config: CameraConfig) {
    super(config);
  }

  async connect(): Promise<PTZResponse> {
    return new Promise((resolve) => {
      try {
        const host = this.config.host ?? 'localhost';
        const port = this.config.port ?? 5001;

        this.socket = new net.Socket();

        // ─── 연결 타임아웃 (5초) ───────────────────────────────
        const timer = setTimeout(() => {
          if (!this.connected) {
            this.socket?.destroy();
            this.socket = null;
            resolve(this.buildResponse(false, 'Connection timeout'));
          }
        }, 5000);

        this.socket.connect(port, host, () => {
          clearTimeout(timer);
          this.connected = true;
          resolve(this.buildResponse(true, `Connected to ujin device at ${host}:${port}`));
        });

        this.socket.on('error', (err) => {
          clearTimeout(timer);
          this.connected = false;
          resolve(this.buildResponse(false, `Connection error: ${err.message}`));
        });

        this.socket.on('close', () => {
          this.connected = false;
        });
      } catch (error) {
        resolve(this.buildResponse(false, `Failed to connect: ${(error as Error).message}`));
      }
    });
  }

  async disconnect(): Promise<PTZResponse> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    return this.buildResponse(true, 'Disconnected');
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
        this.socket!.write(Buffer.from(packet), (err) => {
          if (err) {
            resolve(this.buildResponse(false, `Send error: ${err.message}`));
          } else {
            const hex = packet.map(b => b.toString(16).padStart(2, '0'));
            resolve(this.buildResponse(true, 'ujin command sent', { packet: hex }));
          }
        });
      } catch (error) {
        resolve(this.buildResponse(false, `Send failed: ${(error as Error).message}`));
      }
    });
  }

  private buildPacket(command: PTZCommand): number[] | null {
    const address = this.config.address ?? 1;
    const speed   = this.speedToBytes(command.speed ?? 50);

    let cmd1   = 0x00;
    let cmd2   = 0x00;
    let data1  = 0x00;
    let data2  = 0x00;
    let extCmd = 0x00; // ujin 전용 확장 바이트

    switch (command.action) {
      case 'stop':
        // 전부 0x00 → 정지
        break;

      case 'pan':
        data1  = speed;
        if (command.direction === 'left')      cmd2 = 0x04;
        else if (command.direction === 'right') cmd2 = 0x02;
        extCmd = 0x01; // ujin smooth pan mode
        break;

      case 'tilt':
        data2  = speed;
        if (command.direction === 'up')        cmd2 = 0x08;
        else if (command.direction === 'down') cmd2 = 0x10;
        extCmd = 0x02; // ujin smooth tilt mode
        break;

      case 'zoom':
        if (command.direction === 'in')        cmd2 = 0x20;
        else if (command.direction === 'out')  cmd2 = 0x40;
        extCmd = 0x10; // ujin zoom acceleration
        break;

      case 'focus':
        // ⚠️ 버그 수정: Focus Near 는 CMD2 bit0 = 0x01 (PelcoD 표준 준수)
        //   이전 코드: cmd1 = 0x01 → Iris Open 신호였음
        if (command.direction === 'near') {
          cmd2   = 0x01; // Focus Near (CMD2 bit0)
          extCmd = 0x20; // ujin auto-focus hint
        } else if (command.direction === 'far') {
          cmd2   = 0x80; // Focus Far  (CMD2 bit7)
          extCmd = 0x20;
        }
        break;

      case 'preset':
        if (command.presetNumber !== undefined) {
          cmd2   = 0x07;
          data2  = command.presetNumber & 0xFF;
          extCmd = 0x40; // ujin fast preset mode
        }
        break;

      case 'custom':
        // ujin 전용 커스텀 명령: hex 문자열 "AA FF 01 00 ..." 형식
        if (command.customCommand) {
          return this.parseCustomCommand(command.customCommand);
        }
        return null;

      default:
        return null;
    }

    // ujin 패킷: [AA] [FF] [ADDR] [CMD1] [CMD2] [DATA1] [DATA2] [EXT] [CHECKSUM]
    const packet = [this.UJIN_HEADER, this.SYNC_BYTE, address, cmd1, cmd2, data1, data2, extCmd];
    const checksum = packet.reduce((sum, b) => sum + b, 0) % 256;
    packet.push(checksum);
    return packet;
  }

  /**
   * 커스텀 명령 파싱 (hex 공백 구분 문자열 → 바이트 배열)
   * 예: "AA FF 01 00 02 20 00 00 XX"
   */
  private parseCustomCommand(customCommand: string): number[] | null {
    try {
      const bytes = customCommand.trim().split(/\s+/).map(hex => parseInt(hex, 16));
      if (bytes.length > 0 && bytes.every(b => !isNaN(b) && b >= 0 && b <= 255)) {
        return bytes;
      }
    } catch {
      // 파싱 실패 시 null 반환
    }
    return null;
  }

  /** Proxy 모드용: TCP 소켓 없이 패킷 배열만 생성하여 반환 */
  generatePacket(command: PTZCommand): number[] | null {
    return this.buildPacket(command);
  }
}
