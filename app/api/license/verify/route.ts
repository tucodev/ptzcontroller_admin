import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense, verifyLicenseFile, LICENSE_FILE_PATH } from '@/lib/license';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/license/verify
 * 현재 저장된 라이센스 파일의 유효성을 확인.
 * 로그인 페이지 진입 시 라이센스 보유 여부 확인에 사용.
 */
export async function GET() {
  const result = verifyLicenseFile();
  return NextResponse.json(result);
}

/**
 * POST /api/license/verify
 * 업로드된 라이센스 파일을 검증하고 유효하면 저장.
 * body: multipart/form-data, field name: 'license'
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file     = formData.get('license') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '라이센스 파일이 없습니다' },
        { status: 400 }
      );
    }

    // .ptzlic 확장자만 허용
    if (!file.name.endsWith('.ptzlic')) {
      return NextResponse.json(
        { error: '.ptzlic 파일만 업로드 가능합니다' },
        { status: 400 }
      );
    }

    const content = await file.text();
    const result  = verifyLicense(content.trim());

    if (!result.valid) {
      return NextResponse.json(
        { error: result.reason },
        { status: 400 }
      );
    }

    // 검증 통과 → 파일 저장
    fs.mkdirSync(path.dirname(LICENSE_FILE_PATH), { recursive: true });
    fs.writeFileSync(LICENSE_FILE_PATH, content.trim(), 'utf8');
    console.log('[License] License file saved:', LICENSE_FILE_PATH);

    return NextResponse.json({
      success:   true,
      expiresAt: result.expiresAt,
      machineId: result.machineId,
    });
  } catch (error) {
    console.error('[License] Verify error:', error);
    return NextResponse.json(
      { error: '라이센스 검증 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
