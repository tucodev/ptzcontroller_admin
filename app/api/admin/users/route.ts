import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireAdmin, getSessionUser } from '@/lib/auth-utils';

const USER_SELECT = {
  id: true, email: true, name: true, organization: true, role: true, approved: true, createdAt: true,
} as const;

export async function GET() {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

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

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

  try {
    const { email, password, name, organization, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 });
    }
    if (!organization || !organization.trim()) {
      return NextResponse.json({ error: '회사/소속을 입력해주세요' }, { status: 400 });
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
        name:         name.trim(),
        organization: organization.trim(),
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

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

  try {
    const { id, name, organization, role, password, approved } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const updateData: Record<string, string | boolean> = {};
    if (name !== undefined)         updateData.name         = name;
    if (organization !== undefined) updateData.organization = organization;
    if (role !== undefined)         updateData.role         = role === 'admin' ? 'admin' : 'user';
    if (password)                   updateData.password     = await bcrypt.hash(password, 12);
    if (approved !== undefined)     updateData.approved     = Boolean(approved);

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

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const currentUser = getSessionUser(session!);
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser?.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last admin account' }, { status: 400 });
      }
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
