/**
 * /api/downloads/[filename]
 *
 * public/downloads/ 파일을 세션 인증 후 제공한다.
 * Next.js static serving (/downloads/xxx) 은 인증 없이 누구나 접근 가능하므로
 * 이 API route 를 통해 다운로드를 대체한다.
 *
 * proxy-download-modal 및 admin-modal 에서는 /api/downloads/<filename> 경로를 사용해야 한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-utils';
import fs from 'fs';
import path from 'path';

const DOWNLOADS_DIR = path.join(process.cwd(), 'public', 'downloads');

// Content-Type 매핑
const MIME: Record<string, string> = {
  '.exe':      'application/octet-stream',
  '.zip':      'application/zip',
  '.msi':      'application/x-msi',
  '.dmg':      'application/x-apple-diskimage',
  '.sh':       'text/x-shellscript',
  '.bat':      'application/x-bat',
  '.appimage': 'application/octet-stream',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  // 세션 확인 (오프라인 모드 포함)
  const { error } = await requireSession();
  if (error) return error;

  // 경로 이탈 방지
  const safe = path.basename(params.filename);
  if (!safe || safe !== params.filename) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(DOWNLOADS_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const ext  = path.extname(safe).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const buf  = fs.readFileSync(filePath);

  return new NextResponse(buf, {
    headers: {
      'Content-Type':        mime,
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Content-Length':      String(stat.size),
      'Cache-Control':       'no-store',
    },
  });
}
