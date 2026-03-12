import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { getCamerasAsync, saveCameraAsync, deleteCameraAsync } from '@/lib/config-manager';
import { CameraConfig } from '@/lib/types';

// 세션 기반 동적 라우트 — Next.js 빌드 캐시 완전 비활성화
export const dynamic = 'force-dynamic';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * 세션에서 userId 추출 (= email).
 * 모든 저장소(Neon, SQLite, 파일)를 email 기준으로 통일.
 * - 온라인 세션: session.user.email
 * - 오프라인 계속 진행: ptz-offline-userid 쿠키 (= email)
 * - 쿠키도 없으면: 'offline' 폴백
 */
function resolveUserId(
  session: Awaited<ReturnType<typeof requireSession>>['session'],
  request: NextRequest,
): string {
  if (!session) {
    const val = request.cookies.get('ptz-offline-userid')?.value;
    if (val) return decodeURIComponent(val);
    return 'offline';
  }
  const user = getSessionUser(session as { user?: unknown }) as { email?: string; id?: string };
  return user.email ?? user.id ?? 'offline';
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session, request);
  try {
    const cameras = await getCamerasAsync(userId);
    return NextResponse.json({ cameras });
  } catch (e) {
    console.error('[ConfigManager DB] read cameras failed:', e instanceof Error ? e.message : String(e));
    // ✅ 오프라인 모드 또는 DB 오류: 빈 배열 반환 (에러 아님!)
    return NextResponse.json({ 
      cameras: [],
      offline: true,
      message: 'Operating in offline mode — no cameras cached'
    }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session, request);
  try {
    const body = await request.json();
    const camera: CameraConfig = {
      id:            body?.id ?? generateId(),
      name:          body?.name ?? 'New Camera',
      protocol:      body?.protocol ?? 'pelcod',
      operationMode: 'proxy',
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
    console.error('[ConfigManager] save camera failed:', e instanceof Error ? e.message : String(e));
    // ✅ 오프라인 모드: 로컬 저장만 진행 (DB 저장 스킵)
    return NextResponse.json({ 
      success: true,
      offline: true,
      camera: {} 
    }, { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session, request);
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
    console.error('[ConfigManager] update camera failed:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ 
      success: true,
      offline: true,
      camera: {} 
    }, { status: 200 });
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session, request);
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });

    const deleted = await deleteCameraAsync(id, userId);
    return NextResponse.json({ success: deleted });
  } catch (e) {
    console.error('[ConfigManager] delete camera failed:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ success: true, offline: true }, { status: 200 });
  }
}
