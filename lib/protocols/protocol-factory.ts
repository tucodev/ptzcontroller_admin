import { BaseProtocol } from './base-protocol';
import { PelcoDProtocol } from './pelcod-protocol';
import { ONVIFProtocol } from './onvif-protocol';
import { UjinProtocol } from './ujin-protocol';
import { CameraConfig, ProtocolType } from '../types';

export class ProtocolFactory {
  // ⚠️ 서버리스(Cloudtype 등) 환경 주의사항:
  //   워커 프로세스가 재시작되면 이 Map 이 초기화됩니다.
  //   Direct 모드 TCP 연결이 끊어지는 경우 command/route.ts 의
  //   isConnected() → reconnect 로직이 자동으로 처리합니다.
  private static instances: Map<string, BaseProtocol> = new Map();

  /** 매번 새 인스턴스 생성 (proxy 모드의 패킷 생성 등 일회성 용도) */
  static createProtocol(config: CameraConfig): BaseProtocol {
    const protocol = config.protocol ?? 'pelcod';

    switch (protocol) {
      case 'pelcod':  return new PelcoDProtocol(config);
      case 'onvif':   return new ONVIFProtocol(config);
      case 'ujin':    return new UjinProtocol(config);
      case 'custom':
        // TODO: 커스텀 프로토콜 구현 시 CustomProtocol 클래스 추가
        //   현재는 PelcoD 를 기반으로 동작
        return new PelcoDProtocol(config);
      default:
        throw new Error(`Unknown protocol: ${protocol}`);
    }
  }

  /**
   * 기존 인스턴스 재사용 (Direct 모드 TCP 연결 유지용)
   * 프로토콜 타입이 변경된 경우 새 인스턴스로 교체
   */
  static getOrCreateProtocol(config: CameraConfig): BaseProtocol {
    const key = config.id ?? 'default';

    let instance = this.instances.get(key);
    if (!instance || instance.getConfig().protocol !== config.protocol) {
      instance = this.createProtocol(config);
      this.instances.set(key, instance);
    }

    return instance;
  }

  /** 특정 카메라 연결 해제 및 인스턴스 제거 */
  static removeInstance(cameraId: string): void {
    const instance = this.instances.get(cameraId);
    if (instance) {
      instance.disconnect();
      this.instances.delete(cameraId);
    }
  }

  /** 모든 연결 해제 (서버 종료 시 사용) */
  static async disconnectAll(): Promise<void> {
    for (const [, protocol] of this.instances) {
      await protocol.disconnect();
    }
    this.instances.clear();
  }

  static getSupportedProtocols(): { value: ProtocolType; label: string }[] {
    return [
      { value: 'pelcod', label: 'PelcoD' },
      { value: 'onvif',  label: 'ONVIF' },
      { value: 'ujin',   label: 'ujin (PelcoD Variant)' },
      { value: 'custom', label: 'Custom Protocol' },
    ];
  }
}
