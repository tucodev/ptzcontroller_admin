import { BaseProtocol } from './base-protocol';
import { PelcoDProtocol } from './pelcod-protocol';
import { ONVIFProtocol } from './onvif-protocol';
import { UjinProtocol } from './ujin-protocol';
import { CameraConfig, ProtocolType } from '../types';

export class ProtocolFactory {
  private static instances: Map<string, BaseProtocol> = new Map();

  static createProtocol(config: CameraConfig): BaseProtocol {
    const protocol = config?.protocol ?? 'pelcod';
    
    switch (protocol) {
      case 'pelcod':
        return new PelcoDProtocol(config);
      case 'onvif':
        return new ONVIFProtocol(config);
      case 'ujin':
        return new UjinProtocol(config);
      case 'custom':
        // For custom protocols, default to PelcoD as base
        return new PelcoDProtocol(config);
      default:
        throw new Error(`Unknown protocol: ${protocol}`);
    }
  }

  static getOrCreateProtocol(config: CameraConfig): BaseProtocol {
    const key = config?.id ?? 'default';
    
    let instance = this.instances.get(key);
    if (!instance || instance.getConfig()?.protocol !== config?.protocol) {
      instance = this.createProtocol(config);
      this.instances.set(key, instance);
    }
    
    return instance;
  }

  static async disconnectAll(): Promise<void> {
    for (const [, protocol] of this.instances) {
      await protocol?.disconnect?.();
    }
    this.instances.clear();
  }

  static removeInstance(cameraId: string): void {
    const instance = this.instances.get(cameraId);
    if (instance) {
      instance?.disconnect?.();
      this.instances.delete(cameraId);
    }
  }

  static getSupportedProtocols(): { value: ProtocolType; label: string }[] {
    return [
      { value: 'pelcod', label: 'PelcoD' },
      { value: 'onvif', label: 'ONVIF' },
      { value: 'ujin', label: 'ujin (PelcoD Variant)' },
      { value: 'custom', label: 'Custom Protocol' },
    ];
  }
}
