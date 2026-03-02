import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCameras, saveCamera, deleteCamera } from '@/lib/config-manager';
import { CameraConfig } from '@/lib/types';

// Helper to generate ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cameras = getCameras();
    return NextResponse.json({ cameras });
  } catch (error) {
    console.error('Get cameras error:', error);
    return NextResponse.json(
      { error: 'Failed to get cameras' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const camera: CameraConfig = {
      id: body?.id ?? generateId(),
      name: body?.name ?? 'New Camera',
      protocol: body?.protocol ?? 'pelcod',
      connectionType: body?.connectionType ?? 'tcp',
      operationMode: body?.operationMode ?? 'direct',
      host: body?.host,
      port: body?.port,
      serialPort: body?.serialPort,
      baudRate: body?.baudRate,
      address: body?.address ?? 1,
      username: body?.username,
      password: body?.password,
      proxyUrl: body?.proxyUrl,
      enabled: body?.enabled ?? true,
      createdAt: body?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = saveCamera(camera);
    return NextResponse.json({ success: true, camera: saved });
  } catch (error) {
    console.error('Save camera error:', error);
    return NextResponse.json(
      { error: 'Failed to save camera' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Camera ID is required' },
        { status: 400 }
      );
    }

    const cameras = getCameras();
    const existingCamera = cameras.find((c: CameraConfig) => c.id === id);
    
    if (!existingCamera) {
      return NextResponse.json(
        { error: 'Camera not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updatedCamera: CameraConfig = {
      ...existingCamera,
      name: body?.name ?? existingCamera.name,
      protocol: body?.protocol ?? existingCamera.protocol,
      connectionType: body?.connectionType ?? existingCamera.connectionType,
      operationMode: body?.operationMode ?? existingCamera.operationMode,
      host: body?.host ?? existingCamera.host,
      port: body?.port ?? existingCamera.port,
      serialPort: body?.serialPort ?? existingCamera.serialPort,
      baudRate: body?.baudRate ?? existingCamera.baudRate,
      address: body?.address ?? existingCamera.address,
      username: body?.username ?? existingCamera.username,
      password: body?.password ?? existingCamera.password,
      proxyUrl: body?.proxyUrl ?? existingCamera.proxyUrl,
      enabled: body?.enabled ?? existingCamera.enabled,
      updatedAt: new Date().toISOString(),
    };

    const saved = saveCamera(updatedCamera);
    return NextResponse.json({ success: true, camera: saved });
  } catch (error) {
    console.error('Update camera error:', error);
    return NextResponse.json(
      { error: 'Failed to update camera' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Camera ID is required' },
        { status: 400 }
      );
    }

    const deleted = deleteCamera(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Delete camera error:', error);
    return NextResponse.json(
      { error: 'Failed to delete camera' },
      { status: 500 }
    );
  }
}
