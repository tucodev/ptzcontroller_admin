import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireAdmin, getSessionUser } from '@/lib/auth-utils';

// 사용자 조회 시 반환할 필드 (비밀번호 제외)
const USER_SELECT = {
  id: true, email: true, name: true, role: true, createdAt: true,
} as const;

// GET: 전체 사용자 목록
export async function GET() {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session; // 세션 확인 후 미사용

  try {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
  }
}

// POST: 사용자 생성 (관리자가 직접 추가)
export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? email.split('@')[0],
        role: role === 'admin' ? 'admin' : 'user',
      },
      select: USER_SELECT,
    });

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// PATCH: 사용자 수정 (role, name, password)
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

  try {
    const { id, name, role, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (name !== undefined)  updateData.name     = name;
    if (role !== undefined)  updateData.role     = role === 'admin' ? 'admin' : 'user';
    if (password)            updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE: 사용자 삭제
export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // 자기 자신은 삭제 불가
    const currentUser = getSessionUser(session!);
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
