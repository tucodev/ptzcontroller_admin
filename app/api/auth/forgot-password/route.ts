import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { sendResetLinkEmail, isSmtpConfigured } from '@/lib/email';

/**
 * POST /api/auth/forgot-password
 * 공개 API: 이메일 입력 → 리셋 토큰 생성 → 이메일로 리셋 링크 발송
 * 보안: 사용자 존재 여부와 무관하게 동일한 응답 반환 (이메일 열거 공격 방지)
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }

    // SMTP 확인
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        { error: 'SMTP가 설정되지 않아 이메일을 발송할 수 없습니다. 관리자에게 문의하세요.' },
        { status: 500 },
      );
    }

    // 동일한 응답 메시지 (사용자 유무 노출 방지)
    const successMessage = '등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다.';

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true },
    });

    if (!user) {
      // 사용자 없어도 동일 응답 (보안)
      return NextResponse.json({ success: true, message: successMessage });
    }

    // 토큰 생성 + 만료시간 (1시간)
    const resetToken = randomUUID();
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1시간

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp },
    });

    // 이메일 발송
    const result = await sendResetLinkEmail(user.email, resetToken);
    if (!result.success) {
      console.error('[ForgotPassword] Email send failed:', result.error);
      // 발송 실패해도 동일 응답 (보안)
    }

    return NextResponse.json({ success: true, message: successMessage });
  } catch (err) {
    console.error('[ForgotPassword] Error:', err);
    return NextResponse.json({ error: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
