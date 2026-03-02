import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

// 업로드 파일 저장 경로: public/downloads/
const DOWNLOADS_DIR = path.join(process.cwd(), 'public', 'downloads');

function ensureDownloadsDir() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as { role?: string })?.role !== 'admin') return null;
  return session;
}

// GET: 현재 업로드된 proxy 파일 목록 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    ensureDownloadsDir();

    const files = fs.existsSync(DOWNLOADS_DIR)
      ? fs.readdirSync(DOWNLOADS_DIR).map((filename) => {
          const filePath = path.join(DOWNLOADS_DIR, filename);
          const stat = fs.statSync(filePath);
          return {
            filename,
            size: stat.size,
            uploadedAt: stat.mtime.toISOString(),
            downloadUrl: `/downloads/${filename}`,
          };
        })
      : [];

    return NextResponse.json({ files });
  } catch (error) {
    console.error('List proxy files error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

// POST: 파일 업로드 (multipart/form-data)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    ensureDownloadsDir();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 파일명 보안 처리 (경로 이탈 방지)
    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-]/g, '_');
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // 허용 확장자: .exe, .zip, .sh, .bat, .msi, .dmg
    const ext = path.extname(safeName).toLowerCase();
    const allowedExts = ['.exe', '.zip', '.sh', '.bat', '.msi', '.dmg', '.appimage'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: `Not allowed extension. Allowed: ${allowedExts.join(', ')}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const destPath = path.join(DOWNLOADS_DIR, safeName);

    fs.writeFileSync(destPath, buffer);

    return NextResponse.json({
      success: true,
      filename: safeName,
      size: buffer.length,
      downloadUrl: `/downloads/${safeName}`,
    });
  } catch (error) {
    console.error('Upload proxy file error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// DELETE: 파일 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
  } catch (error) {
    console.error('Delete proxy file error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
