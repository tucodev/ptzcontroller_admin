import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';
import { ProtocolFactory } from '@/lib/protocols/protocol-factory';

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const { cameraId } = await request.json() ?? {};

    if (!cameraId) {
      return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    // Direct 모드 TCP 연결 해제 및 인스턴스 제거
    // Proxy 모드는 클라이언트(WebSocket)에서 직접 close 하므로 여기서는 무시
    ProtocolFactory.removeInstance(cameraId);

    return NextResponse.json({ success: true, message: 'Disconnected successfully' });
  } catch (err) {
    console.error('Disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
