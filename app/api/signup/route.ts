import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// seed 계정 — 첫 번째 실제 사용자 판단 시 제외
const SEED_EMAILS = new Set(['john@doe.com']);

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, organization } = await request.json() ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 });
    }
    if (!organization || !organization.trim()) {
      return NextResponse.json({ error: '회사/소속을 입력해주세요' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // 첫 번째 실제 가입자 자동 admin
    const realUserCount = await prisma.user.count({
      where: { email: { notIn: [...SEED_EMAILS] } },
    });
    const role = realUserCount === 0 ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name:         name.trim(),
        organization: organization.trim(),
        role,
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, organization: user.organization, role: user.role },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
