import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllMachineIds } from '@/lib/license';

export const dynamic = 'force-dynamic';

/**
 * POST /api/license/request-online
 *
 * 역할: 인증 게이트웨이 + 라이선스 서버 프록시
 * 
 * 온라인 상태에서 라이선스 발급 서버에 발급 요청을 전송.
 * - 현재 로그인 사용자의 userId, email + MachineID 를 라이선스 서버로 전달
 * - 라이선스 서버 URL: .env 의 LICENSE_SERVER_URL
 *
 * - 로그인 세션을 확인해 미인증 요청을 차단 (라이선스 서버 직접 노출 방지)
 * - LICENSE_SERVER_URL 은 서버 환경변수로만 존재 → 브라우저에 노출되지 않음
 * - 라이선스 파일은 서버에 저장하지 않고 브라우저로만 반환
 *   브라우저에서 사용자가 직접 저장:
 *     admin(web) : 다운로드 버튼 / 폴더 선택 저장 (File System Access API)
 *     desktop    : /api/license/verify POST 로 로컬 저장
 *
 * 응답:
 *   { status: 'pending'|'approved', requestId?, license?, machineId, message }
 *
 * 'approved' 반환 시(재요청 등) 라이선스를 로컬에 자동 저장 (---> 서버는 저장하지 않는 걸로 수정함)
 */
export async function POST(request: NextRequest) {
  // 로그인 세션 확인 — 미인증 요청 차단
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const licenseServerUrl = process.env.LICENSE_SERVER_URL;
  if (!licenseServerUrl) {
    return NextResponse.json(
      { error: 'LICENSE_SERVER_URL 환경변수가 설정되지 않았습니다' },
      { status: 500 }
    );
  }

  try {
    const user      = session.user as { id?: string; email?: string };
    const userId    = user.id ?? user.email ?? 'unknown';
    const userEmail = user.email ?? '';
    const machineIds = getAllMachineIds(); // 모든 내장 NIC ID (비활성화 포함)
    const machineId  = machineIds[0] ?? 'UNKNOWN'; // 대표값 (하위 호환용)

    // DB에서 이름/소속 조회
    let userName = '';
    let userOrg  = '';
    try {
      const { prisma } = await import('@/lib/db');
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, organization: true },
      });
      userName = dbUser?.name         ?? '';
      userOrg  = dbUser?.organization ?? '';
    } catch { /* DB 조회 실패 시 빈값으로 진행 */ }

    // 라이선스 서버로 발급 요청 전달
    const res  = await fetch(`${licenseServerUrl}/api/license/request`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, userEmail, userName, userOrg, machineId, machineIds }),
      signal:  AbortSignal.timeout(10_000),
    });

    const data = await res.json();

//  현재 : 결과를 브라우저로 그대로 반환 (서버 측 저장 없음)
//    // 이전 : 서버가 즉시 approved 반환 시 (재요청 등) 로컬 자동 저장 --> 서버의 경우 저장하지 않는 걸로 수정
//    if (data.status === 'approved' && data.license) {
//      saveLicenseLocally(data.license);
//    }

    return NextResponse.json({ ...data, machineId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LicenseRequest] Error:', message);
    return NextResponse.json(
      { error: `라이선스 서버 연결 실패: ${message}` },
      { status: 502 }
    );
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
    console.log('[License] Saved locally:', dir);
  } catch (e) {
    console.error('[License] Failed to save:', e);
  }
}
*/
