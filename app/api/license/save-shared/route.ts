import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense, LICENSE_FILE_PATH } from '@/lib/license';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/license/save-shared
 * 발급받은 라이선스를 서버(로컬 PC)의 공유 경로에 저장.
 * - Windows : C:\ProgramData\PTZController\offline.ptzlic
 * - macOS   : /Library/Application Support/PTZController/offline.ptzlic
 * - Linux   : ~/.config/PTZController/offline.ptzlic
 *
 * ptzcontroller_desktop 도 동일 경로를 읽으므로 저장 후 바로 인식됨.
 * body: { license: string }  (base64 또는 JWT 문자열)
 */
export async function POST(request: NextRequest) {
  try {
    const { license } = await request.json();

    if (!license || typeof license !== 'string') {
      return NextResponse.json({ error: '라이선스 데이터가 없습니다' }, { status: 400 });
    }

    const content = license.trim();

    // 저장 전 유효성 검증
    const result = verifyLicense(content);
    if (!result.valid) {
      return NextResponse.json({ error: `유효하지 않은 라이선스: ${result.reason}` }, { status: 400 });
    }

    // 폴더 생성 (없으면 자동 생성)
    const dir = path.dirname(LICENSE_FILE_PATH);
    fs.mkdirSync(dir, { recursive: true });

    // 파일 저장
    fs.writeFileSync(LICENSE_FILE_PATH, content, 'utf8');
    console.log('[License] Saved to shared path:', LICENSE_FILE_PATH);

    return NextResponse.json({
      success:   true,
      savedPath: LICENSE_FILE_PATH,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('[License] save-shared error:', error);
    return NextResponse.json(
      { error: '저장 중 오류가 발생했습니다: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
