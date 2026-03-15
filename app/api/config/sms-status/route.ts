import { NextResponse } from 'next/server';
import { isSmsConfigured } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/** GET /api/config/sms-status — Aligo SMS 환경변수 설정 여부 반환 */
export async function GET() {
  return NextResponse.json({ configured: isSmsConfigured() });
}
