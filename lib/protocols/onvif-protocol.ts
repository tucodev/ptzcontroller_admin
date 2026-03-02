import { BaseProtocol } from './base-protocol';
import { PTZCommand, PTZResponse, CameraConfig } from '../types';

export class ONVIFProtocol extends BaseProtocol {
  private profileToken: string = 'Profile_1';
  private baseUrl: string = '';

  constructor(config: CameraConfig) {
    super(config);
    const host = config?.host ?? 'localhost';
    const port = config?.port ?? 80;
    this.baseUrl = `http://${host}:${port}/onvif`;
  }

  async connect(): Promise<PTZResponse> {
    try {
      // Test connection by getting device info
      const response = await this.sendSoapRequest('device_service', this.getDeviceInfoSoap());
      if (response?.success) {
        this.connected = true;
        return this.buildResponse(true, 'Connected to ONVIF device');
      }
      return response;
    } catch (error) {
      return this.buildResponse(false, `Connection failed: ${(error as Error)?.message ?? 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<PTZResponse> {
    this.connected = false;
    return this.buildResponse(true, 'Disconnected');
  }

  async sendCommand(command: PTZCommand): Promise<PTZResponse> {
    if (!this.connected) {
      return this.buildResponse(false, 'Not connected');
    }

    const soapBody = this.buildSoapBody(command);
    if (!soapBody) {
      return this.buildResponse(false, 'Invalid command');
    }

    return await this.sendSoapRequest('ptz_service', soapBody);
  }

  private buildSoapBody(command: PTZCommand): string | null {
    const speed = (command?.speed ?? 50) / 100;

    switch (command?.action) {
      case 'stop':
        return this.getStopSoap();

      case 'pan':
      case 'tilt': {
        let panSpeed = 0;
        let tiltSpeed = 0;
        if (command?.action === 'pan') {
          panSpeed = command?.direction === 'left' ? -speed : speed;
        } else {
          tiltSpeed = command?.direction === 'up' ? speed : -speed;
        }
        return this.getContinuousMoveSoap(panSpeed, tiltSpeed, 0);
      }

      case 'zoom': {
        const zoomSpeed = command?.direction === 'in' ? speed : -speed;
        return this.getContinuousMoveSoap(0, 0, zoomSpeed);
      }

      case 'preset':
        if (command?.presetNumber !== undefined) {
          return this.getGotoPresetSoap(command.presetNumber);
        }
        return null;

      default:
        return null;
    }
  }

  private async sendSoapRequest(service: string, body: string): Promise<PTZResponse> {
    try {
      const username = this.config?.username ?? '';
      const password = this.config?.password ?? '';
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/soap+xml; charset=utf-8',
      };

      if (username && password) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      }

      const response = await fetch(`${this.baseUrl}/${service}`, {
        method: 'POST',
        headers,
        body,
      });

      if (response?.ok) {
        return this.buildResponse(true, 'Command sent successfully');
      }
      return this.buildResponse(false, `HTTP error: ${response?.status ?? 'Unknown'}`);
    } catch (error) {
      return this.buildResponse(false, `Request failed: ${(error as Error)?.message ?? 'Unknown error'}`);
    }
  }

  private getSoapEnvelope(body: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Body>${body}</s:Body>
</s:Envelope>`;
  }

  private getDeviceInfoSoap(): string {
    return this.getSoapEnvelope(`
    <tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>
    `);
  }

  private getContinuousMoveSoap(panSpeed: number, tiltSpeed: number, zoomSpeed: number): string {
    return this.getSoapEnvelope(`
    <tptz:ContinuousMove>
      <tptz:ProfileToken>${this.profileToken}</tptz:ProfileToken>
      <tptz:Velocity>
        <tt:PanTilt x="${panSpeed}" y="${tiltSpeed}"/>
        <tt:Zoom x="${zoomSpeed}"/>
      </tptz:Velocity>
    </tptz:ContinuousMove>
    `);
  }

  private getStopSoap(): string {
    return this.getSoapEnvelope(`
    <tptz:Stop>
      <tptz:ProfileToken>${this.profileToken}</tptz:ProfileToken>
      <tptz:PanTilt>true</tptz:PanTilt>
      <tptz:Zoom>true</tptz:Zoom>
    </tptz:Stop>
    `);
  }

  private getGotoPresetSoap(presetNumber: number): string {
    return this.getSoapEnvelope(`
    <tptz:GotoPreset>
      <tptz:ProfileToken>${this.profileToken}</tptz:ProfileToken>
      <tptz:PresetToken>Preset_${presetNumber}</tptz:PresetToken>
    </tptz:GotoPreset>
    `);
  }
}
