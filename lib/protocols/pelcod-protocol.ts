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
        const host = this.config.host ?? 'localhost';
        const port = this.config.port ?? 5000;

        this.socket = new net.Socket();

        // ─── 연결 타임아웃 (5초) ───────────────────────────────
        // clearTimeout 을 onopen/onerror 양쪽에서 호출해야
        // 이미 resolve 된 뒤 타임아웃 콜백이 재실행되는 버그를 방지
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
          resolve(this.buildResponse(true, `Connected to ${host}:${port}`));
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
            resolve(this.buildResponse(true, 'Command sent', { packet: hex }));
          }
        });
      } catch (error) {
        resolve(this.buildResponse(false, `Send failed: ${(error as Error).message}`));
      }
    });
  }

  // ─── PelcoD 패킷 생성 ─────────────────────────────────────
  // 패킷 구조: [SYNC(FF)] [ADDR] [CMD1] [CMD2] [DATA1] [DATA2] [CHECKSUM]
  // CHECKSUM = (ADDR + CMD1 + CMD2 + DATA1 + DATA2) % 256
  private buildPacket(command: PTZCommand): number[] | null {
    const address = this.config.address ?? 1;
    const speed = this.speedToBytes(command.speed ?? 50);

    let cmd1 = 0x00;
    let cmd2 = 0x00;
    let data1 = 0x00;
    let data2 = 0x00;

    switch (command.action) {
      case 'stop':
        // cmd1, cmd2, data1, data2 모두 0x00 → 전체 정지
        break;

      case 'pan':
        data1 = speed; // Pan speed byte
        if (command.direction === 'left')      cmd2 = 0x04;
        else if (command.direction === 'right') cmd2 = 0x02;
        break;

      case 'tilt':
        data2 = speed; // Tilt speed byte
        if (command.direction === 'up')        cmd2 = 0x08;
        else if (command.direction === 'down') cmd2 = 0x10;
        break;

      case 'zoom':
        if (command.direction === 'in')        cmd2 = 0x20;
        else if (command.direction === 'out')  cmd2 = 0x40;
        break;

      case 'focus':
        // ⚠️ 버그 수정: Focus Near 는 CMD2 bit0 = 0x01 (PelcoD 표준)
        //   이전 코드: cmd1 = 0x01 → 실제로는 Iris Open 신호였음
        if (command.direction === 'near')      cmd2 = 0x01; // Focus Near (CMD2 bit0)
        else if (command.direction === 'far')  cmd2 = 0x80; // Focus Far  (CMD2 bit7)
        break;

      case 'preset':
        if (command.presetNumber !== undefined) {
          cmd2  = 0x07;                       // Go to preset
          data2 = command.presetNumber & 0xFF;
        }
        break;

      default:
        return null;
    }

    // PelcoD 패킷 구조: SYNC(FF) + ADDR + CMD1 + CMD2 + DATA1 + DATA2 + CHECKSUM
    // CHECKSUM = (ADDR + CMD1 + CMD2 + DATA1 + DATA2) % 256
    const packet = [this.SYNC_BYTE, address, cmd1, cmd2, data1, data2];
    const checksum = (address + cmd1 + cmd2 + data1 + data2) % 256;
    packet.push(checksum);
    return packet;
  }

  /** Proxy 모드용: TCP 소켓 없이 패킷 배열만 생성하여 반환  — proxy 모드에서 서버가 패킷을 만들어 클라이언트에 전달할 때 사용 */
  generatePacket(command: PTZCommand): number[] | null {
    return this.buildPacket(command);
  }
}
