import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const { cameraId } = await request.json() ?? {};
    if (!cameraId) {
      return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    // Proxy 모드: 실제 연결 해제는 브라우저의 WebSocket.close() 가 처리.
    // 서버는 상태를 유지하지 않으므로 단순 OK 반환.
    return NextResponse.json({ success: true, message: 'Disconnected' });
  } catch (err) {
    console.error('Disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
