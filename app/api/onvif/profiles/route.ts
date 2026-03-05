/**
 * /api/onvif/profiles
 *
 * ONVIF 카메라의 GetProfiles 를 호출해 사용 가능한 profileToken 목록을 반환한다.
 *
 * 동작 방식:
 *   - 이 API는 ptz-proxy-electron 이 실행 중인 환경을 전제로 한다.
 *   - 브라우저(add-camera-modal)에서 host/port/username/password/proxyUrl 을 전달하면
 *     서버가 proxy WebSocket 에 { type:'onvif_get_profiles', config:{...} } 를 전송하고
 *     proxy가 카메라에 SOAP 요청 후 결과를 WS로 돌려준다.
 *
 *   단, 이 방식은 서버↔proxy 간 추가 WS 연결이 필요해 복잡하다.
 *   → 더 간단한 대안: 브라우저가 직접 proxy WS 에 요청 후 결과를 받아 표시.
 *     이 route는 브라우저가 WS 연결 없이 서버를 통해 탐색할 때를 위한 fallback.
 *
 * 실제 구현 전략:
 *   Proxy 아키텍처에서 서버는 카메라에 직접 접근 불가.
 *   따라서 이 route는 **브라우저가 직접 proxy WS 로 탐색 요청을 보내는 방식**을 안내하고,
 *   프록시가 없는 경우(동일 네트워크 서버 환경) 서버에서 직접 SOAP 호출도 시도한다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';
import { getOnvifProfiles } from '@/lib/onvif-client';

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const { host, port, username, password } = await request.json();

    if (!host || !port) {
      return NextResponse.json({ error: 'host, port 는 필수입니다.' }, { status: 400 });
    }

    const result = await getOnvifProfiles({ host, port, username, password });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[onvif/profiles]', err);
    return NextResponse.json(
      { error: (err as Error).message || 'ONVIF 탐색 실패' },
      { status: 500 },
    );
  }
}
