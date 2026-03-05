import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { getCamerasAsync, saveCameraAsync, deleteCameraAsync } from '@/lib/config-manager';
import { CameraConfig } from '@/lib/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * 세션에서 userId 추출.
 * JWT 세션이면 token.id (DB User.id), 오프라인이면 'offline'.
 * id가 없으면 'shared' 대신 'offline' 으로 폴백하여
 * data/ 바로 아래가 아닌 data/users/offline/ 에 저장되도록 한다.
 */
function resolveUserId(session: Awaited<ReturnType<typeof requireSession>>['session']): string {
  if (!session) return 'offline';
  const user = getSessionUser(session as { user?: unknown });
  // user.id 가 undefined/null/빈문자 이면 'offline' 으로 폴백
  const id = user.id;
  if (!id || typeof id !== 'string' || id.trim() === '') return 'offline';
  return id;
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const cameras = await getCamerasAsync(userId);
    return NextResponse.json({ cameras });
  } catch (e) {
    console.error('Get cameras error:', e);
    return NextResponse.json({ error: 'Failed to get cameras' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const body = await request.json();
    const camera: CameraConfig = {
      id:            body?.id ?? generateId(),
      name:          body?.name ?? 'New Camera',
      protocol:      body?.protocol ?? 'pelcod',
      operationMode: 'proxy',          // 항상 proxy 고정
      host:          body?.host,
      port:          body?.port,
      address:       body?.address ?? 1,
      username:      body?.username,
      password:      body?.password,
      profileToken:  body?.profileToken,
      proxyUrl:      body?.proxyUrl ?? 'ws://localhost:9902',
      enabled:       body?.enabled ?? true,
      createdAt:     body?.createdAt ?? new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    };
    const saved = await saveCameraAsync(camera, userId);
    return NextResponse.json({ success: true, camera: saved });
  } catch (e) {
    console.error('Save camera error:', e);
    return NextResponse.json({ error: 'Failed to save camera' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });

    const cameras = await getCamerasAsync(userId);
    const existing = cameras.find((c: CameraConfig) => c.id === id);
    if (!existing) return NextResponse.json({ error: 'Camera not found' }, { status: 404 });

    const body = await request.json();
    const updated: CameraConfig = {
      ...existing,
      name:      body?.name      ?? existing.name,
      protocol:  body?.protocol  ?? existing.protocol,
      host:      body?.host      ?? existing.host,
      port:      body?.port      ?? existing.port,
      address:   body?.address   ?? existing.address,
      username:     body?.username     ?? existing.username,
      password:     body?.password     ?? existing.password,
      profileToken: body?.profileToken !== undefined ? body.profileToken : existing.profileToken,
      proxyUrl:     body?.proxyUrl     ?? existing.proxyUrl,
      enabled:   body?.enabled   ?? existing.enabled,
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveCameraAsync(updated, userId);
    return NextResponse.json({ success: true, camera: saved });
  } catch (e) {
    console.error('Update camera error:', e);
    return NextResponse.json({ error: 'Failed to update camera' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });

    const deleted = await deleteCameraAsync(id, userId);
    return NextResponse.json({ success: deleted });
  } catch (e) {
    console.error('Delete camera error:', e);
    return NextResponse.json({ error: 'Failed to delete camera' }, { status: 500 });
  }
}
