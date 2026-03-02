import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ProtocolFactory } from '@/lib/protocols/protocol-factory';
import { getCamera } from '@/lib/config-manager';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cameraId } = body ?? {};

    if (!cameraId) {
      return NextResponse.json(
        { error: 'Camera ID is required' },
        { status: 400 }
      );
    }

    const camera = getCamera(cameraId);
    if (!camera) {
      return NextResponse.json(
        { error: 'Camera not found' },
        { status: 404 }
      );
    }


   // add for login redirect

    // For proxy mode, return proxy connection info
    if (camera?.operationMode === 'proxy') {
      // proxyUrl이 빈 문자열이거나 없으면 기본값 사용
      const proxyUrl = camera?.proxyUrl && camera.proxyUrl.trim() !== '' 
        ? camera.proxyUrl 
        : 'ws://localhost:9902';
      
      return NextResponse.json({
        success: true,
        mode: 'proxy',
        proxyUrl,
        message: 'Use WebSocket proxy for connection',
      });
    }

    // Direct mode
    const protocol = ProtocolFactory.getOrCreateProtocol(camera);
    const result = await protocol?.connect?.();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect' },
      { status: 500 }
    );
  }
}
