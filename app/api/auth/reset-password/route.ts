import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/reset-password
 * 공개 API: 리셋 토큰 + 새 비밀번호 → 비밀번호 변경
 */
export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    // 토큰으로 사용자 조회
    const user = await prisma.user.findFirst({
      where: { resetToken: token },
      select: { id: true, resetTokenExp: true },
    });

    if (!user) {
      return NextResponse.json({ error: '유효하지 않거나 이미 사용된 토큰입니다.' }, { status: 400 });
    }

    // 만료 확인
    if (!user.resetTokenExp || user.resetTokenExp < new Date()) {
      // 만료된 토큰 정리
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExp: null },
      });
      return NextResponse.json({ error: '토큰이 만료되었습니다. 다시 요청해주세요.' }, { status: 400 });
    }

    // 비밀번호 변경 + 토큰 무효화
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
    });
  } catch (err) {
    console.error('[ResetPassword] Error:', err);
    return NextResponse.json({ error: '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
