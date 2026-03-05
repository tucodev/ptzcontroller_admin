import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
//import * as fs from 'fs';
//import * as path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/license/poll?requestId=...
 *
 * 역할: 인증 게이트웨이 + 라이선스 서버 프록시
 *
 * - 로그인 세션을 확인해 미인증 요청을 차단 (라이선스 서버 직접 노출 방지)
 * - LICENSE_SERVER_URL 은 서버 환경변수로만 존재 → 브라우저에 노출되지 않음
 * - 라이선스 파일은 서버에 저장하지 않고 브라우저로만 반환
 *   브라우저에서 사용자가 직접 저장:
 *     admin(web) : 다운로드 버튼 / 폴더 선택 저장 (File System Access API)
 *     desktop    : /api/license/verify POST 로 로컬 저장
 *
 * settings-modal 이 30초 간격으로 호출.

 * 응답:
 *   { status: 'pending'|'approved'|'rejected', license?, expiresAt?, note? }
 *
 * 'approved' 반환 시 라이선스를 로컬에 자동 저장  (Desktop 인 경우 저장함, 서버의 경우 저장하지 않는다)
 */
export async function GET(request: NextRequest) {
  // 로그인 세션 확인 — 미인증 요청 차단
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const requestId = searchParams.get('requestId');

  if (!requestId) {
    return NextResponse.json({ error: 'requestId 필요' }, { status: 400 });
  }

  const licenseServerUrl = process.env.LICENSE_SERVER_URL;
  if (!licenseServerUrl) {
    return NextResponse.json({ error: 'LICENSE_SERVER_URL 미설정' }, { status: 500 });
  }

  try {
    // 라이선스 서버에 승인 여부 조회
    const res  = await fetch(`${licenseServerUrl}/api/license/poll/${requestId}`, {
      signal: AbortSignal.timeout(8_000),
    });
    const data = await res.json();

// 승인 완료 -> 현재는 : 결과를 브라우저로 그대로 반환 (서버 측 저장 없음)
//    // 이전: 라이선스 로컬 자동 저장 (Desktop 인 경우 저장함, 서버의 경우 저장하지 않는다)
//    if (data.status === 'approved' && data.license) {
//      saveLicenseLocally(data.license);
//    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: `폴링 실패: ${message}` }, { status: 502 });
  }
}

/*
function saveLicenseLocally(licenseB64: string) {
  try {
    const dir = process.env.PTZ_DATA_DIR
      ? path.join(process.env.PTZ_DATA_DIR, 'data')
      : path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'offline.ptzlic'), licenseB64.trim(), 'utf8');
    console.log('[License] Auto-saved from poll');
  } catch (e) {
    console.error('[License] Save failed:', e);
  }
}
*/
