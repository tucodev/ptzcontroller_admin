import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';
import { ProtocolFactory } from '@/lib/protocols/protocol-factory';
import { getCamera } from '@/lib/config-manager';

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const { cameraId } = await request.json() ?? {};

    if (!cameraId) {
      return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    const camera = getCamera(cameraId);
    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    // ─── Proxy 모드 ────────────────────────────────────────
    // proxyUrl 이 비어있으면 기본값(localhost:9902) 사용
    // 실제 WebSocket 연결은 클라이언트(dashboard)에서 직접 수행
    if (camera.operationMode === 'proxy') {
      const proxyUrl = camera.proxyUrl?.trim()
        ? camera.proxyUrl
        : 'ws://localhost:9902';

      return NextResponse.json({
        success: true,
        mode: 'proxy',
        proxyUrl,
        message: 'Use WebSocket proxy for connection',
      });
    }

    // ─── Direct 모드 ───────────────────────────────────────
    const protocol = ProtocolFactory.getOrCreateProtocol(camera);
    const result   = await protocol.connect();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Connect error:', err);
    return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
  }
}
