import { NextResponse } from 'next/server';
import { saveRequestFile, getMachineId, REQUEST_FILE_PATH } from '@/lib/license';
import * as fs from 'fs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/license/request
 * PC 고유코드로 요청 파일을 생성하고 다운로드 응답을 반환.
 * 사용자가 이 파일을 제공자에게 전달하면 라이센스를 발급받을 수 있음.
 */
export async function GET() {
  try {
    const filePath  = saveRequestFile();
    const machineId = getMachineId();
    const content   = fs.readFileSync(filePath, 'utf8');

    return new NextResponse(content, {
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="ptzcontroller-${machineId}.ptzreq"`,
      },
    });
  } catch (error) {
    console.error('[License] Request file creation error:', error);
    return NextResponse.json(
      { error: '요청 파일 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
