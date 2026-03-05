/**
 * /api/proxy-token/verify
 *
 * ptz-proxy-electron 이 WebSocket 연결 수락 전에 토큰을 검증하기 위해 호출하는 엔드포인트.
 *
 * 흐름:
 *   1. 브라우저 → ws://proxy:9902?token=<proxyToken>
 *   2. ptz-proxy-electron: onconnection 핸들러에서 token 추출
 *   3. ptz-proxy-electron → GET /api/proxy-token/verify?token=<proxyToken>
 *   4. 검증 통과 → WS 연결 허용 / 실패 → ws.close(4401)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyProxyToken } from '@/lib/proxy-token';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, reason: 'missing_token' }, { status: 400 });
  }

  const result = verifyProxyToken(token);

  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason }, { status: 401 });
  }

  return NextResponse.json({
    valid:    true,
    cameraId: result.cameraId,
    userId:   result.userId,
  });
}
