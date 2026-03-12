import { verifyOfflineLicense } from '@/lib/offline-mode';
import { saveLicenseUser } from '@/lib/offline-db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/offline/prepare
 *
 * 오프라인으로 계속 진행 전 호출.
 * 라이선스를 검증하고 SQLite에 사용자 레코드를 생성한 뒤
 * userId(= email)를 반환한다. 클라이언트는 이 값을 쿠키에 저장한다.
 */
export async function POST() {
  const license = await verifyOfflineLicense();

  if (!license.valid) {
    return NextResponse.json({ error: 'invalid_license', reason: license.reason }, { status: 403 });
  }

  if (!license.userEmail) {
    // 구 라이선스 (userEmail 없음) → 'offline' fallback 유지
    console.log('[OfflinePrepare] Old license without userEmail, using offline fallback');
    return NextResponse.json({ userId: 'offline', email: null });
  }

  const userId = saveLicenseUser({
    email: license.userEmail,
    name:  license.userName,
    org:   license.userOrg,
  });

  console.log('[OfflinePrepare] License user ready:', userId);
  return NextResponse.json({
    userId,
    email: license.userEmail,
    name:  license.userName,
  });
}
