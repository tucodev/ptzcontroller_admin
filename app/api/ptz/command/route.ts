import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';
import { ProtocolFactory } from '@/lib/protocols/protocol-factory';
import { getCamera } from '@/lib/config-manager';
import { PTZCommand } from '@/lib/types';

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const { cameraId, command } = await request.json() ?? {};

    if (!cameraId || !command) {
      return NextResponse.json(
        { error: 'Camera ID and command are required' },
        { status: 400 }
      );
    }

    const camera = getCamera(cameraId);
    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    // ─── Proxy 모드 ────────────────────────────────────────
    // 서버에서 패킷만 생성하고, 실제 전송은 클라이언트(WebSocket)가 담당
    if (camera.operationMode === 'proxy') {
      const protocol = ProtocolFactory.createProtocol(camera);
      const packet = (protocol as { generatePacket?: (cmd: PTZCommand) => number[] | null })
        .generatePacket?.(command) ?? null;
      return NextResponse.json({
        success: true,
        mode: 'proxy',
        packet,
        proxyUrl: camera.proxyUrl,
      });
    }

    // ─── Direct 모드 ───────────────────────────────────────
    // 서버가 직접 TCP 소켓으로 카메라에 명령 전송
    // 연결이 끊어진 경우 자동 재연결 시도
    const protocol = ProtocolFactory.getOrCreateProtocol(camera);

    if (!protocol.isConnected()) {
      const connectResult = await protocol.connect();
      if (!connectResult.success) {
        return NextResponse.json(
          { error: connectResult.message ?? 'Failed to connect' },
          { status: 500 }
        );
      }
    }

    const result = await protocol.sendCommand(command);
    return NextResponse.json(result);
  } catch (err) {
    console.error('PTZ command error:', err);
    return NextResponse.json({ error: 'Failed to send command' }, { status: 500 });
  }
}
