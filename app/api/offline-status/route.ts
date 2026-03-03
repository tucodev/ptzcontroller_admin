import { NextResponse } from 'next/server';
import { isDbAvailable, resetDbCache } from '@/lib/offline-mode';

// 이 라우트는 항상 동적으로 실행 (DB 상태는 런타임에만 알 수 있음)
export const dynamic = 'force-dynamic';

/**
 * GET /api/offline-status
 * DB 연결 상태 반환. 로그인 페이지에서 오프라인 버튼 표시 여부 결정에 사용.
 */
export async function GET() {
  const dbOk = await isDbAvailable();
  return NextResponse.json({ offline: !dbOk });
}

/**
 * POST /api/offline-status
 * DB 연결 캐시를 초기화하고 재확인. "재연결 시도" 버튼에서 사용.
 */
export async function POST() {
  resetDbCache();
  const dbOk = await isDbAvailable();
  return NextResponse.json({
    offline: !dbOk,
    message: dbOk ? 'DB 연결 복구됨' : '여전히 DB에 연결할 수 없습니다',
  });
}
