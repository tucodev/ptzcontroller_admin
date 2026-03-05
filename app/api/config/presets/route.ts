import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { getPresetsAsync, savePresetAsync, deletePresetAsync } from '@/lib/config-manager';
import { PresetConfig } from '@/lib/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function resolveUserId(session: Awaited<ReturnType<typeof requireSession>>['session']): string {
  if (!session) return 'offline';
  const user = getSessionUser(session as { user?: unknown });
  return user.id ?? 'offline';
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const { searchParams } = new URL(request.url);
    const cameraId = searchParams.get('cameraId');
    const presets = await getPresetsAsync(cameraId ?? undefined, userId);
    return NextResponse.json({ presets });
  } catch (e) {
    console.error('Get presets error:', e);
    return NextResponse.json({ error: 'Failed to get presets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const body = await request.json();
    const preset: PresetConfig = {
      id:          body?.id ?? generateId(),
      cameraId:    body?.cameraId,
      number:      body?.number ?? 1,
      name:        body?.name ?? 'Preset',
      description: body?.description,
    };
    if (!preset?.cameraId) return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });

    const saved = await savePresetAsync(preset, userId);
    return NextResponse.json({ success: true, preset: saved });
  } catch (e) {
    console.error('Save preset error:', e);
    return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Preset ID is required' }, { status: 400 });

    const deleted = await deletePresetAsync(id, userId);
    return NextResponse.json({ success: deleted });
  } catch (e) {
    console.error('Delete preset error:', e);
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
  }
}
