import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth-utils';
import fs from 'fs';
import path from 'path';

// 업로드 파일 저장 경로: public/downloads/
const DOWNLOADS_DIR = path.join(process.cwd(), 'public', 'downloads');

// 허용 파일 확장자
const ALLOWED_EXTS = new Set(['.exe', '.zip', '.sh', '.bat', '.msi', '.dmg', '.appimage']);

function ensureDownloadsDir() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
}

// GET: 업로드된 proxy 파일 목록
//   - 로그인한 사용자 전체 조회 가능 (Proxy 다운로드 팝업에서 사용)
//   - admin 이 아니어도 목록 확인은 허용
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    ensureDownloadsDir();
    const files = fs.readdirSync(DOWNLOADS_DIR).map((filename) => {
      const stat = fs.statSync(path.join(DOWNLOADS_DIR, filename));
      return {
        filename,
        size: stat.size,
        uploadedAt: stat.mtime.toISOString(),
        downloadUrl: `/downloads/${filename}`,
      };
    });
    return NextResponse.json({ files });
  } catch (err) {
    console.error('List proxy files error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

// POST: 파일 업로드 (admin 전용, multipart/form-data)
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    ensureDownloadsDir();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 파일명 보안 처리 (경로 이탈 방지: path.basename + 특수문자 치환)
    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-]/g, '_');
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const ext = path.extname(safeName).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `Not allowed extension. Allowed: ${[...ALLOWED_EXTS].join(', ')}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(DOWNLOADS_DIR, safeName), buffer);

    return NextResponse.json({
      success: true,
      filename: safeName,
      size: buffer.length,
      downloadUrl: `/downloads/${safeName}`,
    });
  } catch (err) {
    console.error('Upload proxy file error:', err);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// DELETE: 파일 삭제 (admin 전용)
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { filename } = await request.json();
    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    const safeName = path.basename(filename);
    const filePath = path.join(DOWNLOADS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete proxy file error:', err);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
