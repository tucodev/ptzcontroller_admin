import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ProtocolFactory } from '@/lib/protocols/protocol-factory';
import { getCamera } from '@/lib/config-manager';
import { PTZCommand } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cameraId, command } = body ?? {};

    if (!cameraId || !command) {
      return NextResponse.json(
        { error: 'Camera ID and command are required' },
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

    // For proxy mode, return the command packet for client-side handling
    if (camera?.operationMode === 'proxy') {
      const protocol = ProtocolFactory.createProtocol(camera);
      const packet = (protocol as { generatePacket?: (cmd: PTZCommand) => number[] | null })?.generatePacket?.(command);
      return NextResponse.json({
        success: true,
        mode: 'proxy',
        packet,
        proxyUrl: camera?.proxyUrl,
      });
    }

    // Direct mode - send command directly
    const protocol = ProtocolFactory.getOrCreateProtocol(camera);
    
    if (!protocol?.isConnected?.()) {
      const connectResult = await protocol?.connect?.();
      if (!connectResult?.success) {
        return NextResponse.json(
          { error: connectResult?.message ?? 'Failed to connect' },
          { status: 500 }
        );
      }
    }

    const result = await protocol?.sendCommand?.(command);
    return NextResponse.json(result);
  } catch (error) {
    console.error('PTZ command error:', error);
    return NextResponse.json(
      { error: 'Failed to send command' },
      { status: 500 }
    );
  }
}
