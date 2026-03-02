import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPresets, savePreset, deletePreset } from '@/lib/config-manager';
import { PresetConfig } from '@/lib/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cameraId = searchParams.get('cameraId');

    const presets = getPresets(cameraId ?? undefined);
    return NextResponse.json({ presets });
  } catch (error) {
    console.error('Get presets error:', error);
    return NextResponse.json(
      { error: 'Failed to get presets' },
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
    const preset: PresetConfig = {
      id: body?.id ?? generateId(),
      cameraId: body?.cameraId,
      number: body?.number ?? 1,
      name: body?.name ?? 'Preset',
      description: body?.description,
    };

    if (!preset?.cameraId) {
      return NextResponse.json(
        { error: 'Camera ID is required' },
        { status: 400 }
      );
    }

    const saved = savePreset(preset);
    return NextResponse.json({ success: true, preset: saved });
  } catch (error) {
    console.error('Save preset error:', error);
    return NextResponse.json(
      { error: 'Failed to save preset' },
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
        { error: 'Preset ID is required' },
        { status: 400 }
      );
    }

    const deleted = deletePreset(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Delete preset error:', error);
    return NextResponse.json(
      { error: 'Failed to delete preset' },
      { status: 500 }
    );
  }
}
