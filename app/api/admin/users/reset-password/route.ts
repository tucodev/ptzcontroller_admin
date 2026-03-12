import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth-utils';
import { sendPasswordResetEmail, generateTempPassword, isSmtpConfigured } from '@/lib/email';

/**
 * POST /api/admin/users/reset-password
 * 관리자 전용: 사용자 비밀번호를 임시 비밀번호로 강제 리셋 → 이메일 발송
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    // SMTP 설정 확인
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        { error: 'SMTP가 설정되지 않았습니다. .env 파일에 SMTP_HOST, SMTP_USER, SMTP_PASS를 설정해주세요.' },
        { status: 500 },
      );
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 임시 비밀번호 생성 + DB 저장
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // 이메일 발송
    const result = await sendPasswordResetEmail(user.email, tempPassword);
    if (!result.success) {
      return NextResponse.json(
        { error: `이메일 발송 실패: ${result.error}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `${user.email}로 임시 비밀번호가 발송되었습니다.`,
    });
  } catch (err) {
    console.error('[Admin] Reset password error:', err);
    return NextResponse.json({ error: '비밀번호 리셋에 실패했습니다.' }, { status: 500 });
  }
}
