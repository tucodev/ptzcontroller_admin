import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';

// Proxy 전용 아키텍처에서 PTZ 명령은 브라우저가 WebSocket 으로 직접 처리.
// 이 엔드포인트는 레거시 Direct 모드용이었으며 더 이상 사용되지 않음.
// 혹시 잘못된 클라이언트가 호출하는 경우를 위해 안내 응답만 반환.
export async function POST() {
  const { error } = await requireSession();
  if (error) return error;

  return NextResponse.json(
    {
      error: 'PTZ commands are handled via WebSocket (Proxy mode). This endpoint is deprecated.',
      hint:  'Send { type:"command", command:{...} } directly to the PTZ Proxy WebSocket server.',
    },
    { status: 410 }, // 410 Gone
  );
}
