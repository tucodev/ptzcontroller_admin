import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { getCamerasAsync } from '@/lib/config-manager';
import { createProxyToken } from '@/lib/proxy-token';

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

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const { cameraId } = await request.json() ?? {};

    if (!cameraId) {
      return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    const userId  = resolveUserId(session, request);
    const cameras = await getCamerasAsync(userId);
    const camera  = cameras.find((c) => c.id === cameraId);

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    const proxyUrl   = camera.proxyUrl?.trim() || 'ws://localhost:9902';

    // tokenAuth 활성화 여부와 무관하게 항상 토큰 생성
    // (ptz-proxy가 tokenAuth=off면 토큰을 무시하고, on이면 검증)
    const proxyToken        = createProxyToken(cameraId, userId);
    const separator         = proxyUrl.includes('?') ? '&' : '?';
    const proxyUrlWithToken = `${proxyUrl}${separator}token=${encodeURIComponent(proxyToken)}`;

    return NextResponse.json({
      success:  true,
      mode:     'proxy',
      proxyUrl: proxyUrlWithToken,
    });
  } catch (err) {
    console.error('Connect error:', err);
    return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
  }
}
