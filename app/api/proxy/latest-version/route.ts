import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'public', 'downloads', 'proxy-config.json');

/**
 * GET /api/proxy/latest-version
 * proxy-config.json에서 최신 Proxy 버전 정보를 반환
 * 인증 불필요 (공개 정보 — Dashboard에서 버전 비교에 사용)
 */
export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return NextResponse.json({
        latestVersion: null,
        fileHash: null,
        updatedAt: null,
        cloudDownloadUrl: null,
      });
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    return NextResponse.json({
      latestVersion: config.latestVersion ?? null,
      fileHash: config.fileHash ?? null,
      updatedAt: config.updatedAt ?? null,
      cloudDownloadUrl: config.cloudDownloadUrl ?? null,
    });
  } catch (err) {
    console.error('Read proxy latest-version error:', err);
    return NextResponse.json({
      latestVersion: null,
      fileHash: null,
      updatedAt: null,
      cloudDownloadUrl: null,
    });
  }
}
