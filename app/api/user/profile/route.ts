import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// ─── 현재 로그인 사용자 프로필 조회 ──────────────────────────
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const sessionUser = getSessionUser(session as { user?: unknown });
  const userId = (sessionUser as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: '유효하지 않은 세션' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, organization: true, role: true, phone: true },
    });
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    return NextResponse.json({ user });
  } catch (e) {
    console.error('[user/profile] GET failed:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// ─── 현재 로그인 사용자 프로필 수정 (이름 / 소속 / 비밀번호) ─
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const sessionUser = getSessionUser(session as { user?: unknown });
  const userId = (sessionUser as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: '유효하지 않은 세션' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, organization, phone, currentPassword, newPassword } = body as {
      name?: string;
      organization?: string;
      phone?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    // 현재 사용자 조회 (비밀번호 해시 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });

    const updateData: Record<string, string | Date> = {
      updatedAt: new Date(),
    };

    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (typeof organization === 'string') {
      updateData.organization = organization.trim();
    }
    if (typeof phone === 'string') {
      updateData.phone = phone.replace(/[-\s]/g, '').trim();
    }

    // 비밀번호 변경 요청 처리
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: '현재 비밀번호를 입력하세요' }, { status: 400 });
      }
      if (!user.password) {
        return NextResponse.json({ error: '비밀번호 변경이 불가한 계정입니다' }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: '비밀번호는 최소 6자 이상이어야 합니다' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    // name/organization 외 변경할 내용이 없으면 조기 반환
    const hasProfileChange = 'name' in updateData || 'organization' in updateData || 'phone' in updateData;
    const hasPasswordChange = 'password' in updateData;
    if (!hasProfileChange && !hasPasswordChange) {
      return NextResponse.json({ error: '변경할 내용이 없습니다' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, organization: true, role: true, phone: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (e) {
    console.error('[user/profile] PATCH failed:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
