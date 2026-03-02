import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// seed.ts 에서 생성한 테스트 계정 — 첫 번째 실제 사용자 판단 시 제외
// seed 계정이 존재해도 다음 실제 가입자가 admin 이 됨
const SEED_EMAILS = new Set(['john@doe.com']);

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json() ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // ─── 첫 번째 실제 가입자 자동 admin 부여 ──────────────
    // seed 계정(john@doe.com 등)을 제외한 실제 사용자 수를 카운트
    // → 0명이면 이번 가입자가 최초이므로 admin 역할 부여
    const realUserCount = await prisma.user.count({
      where: { email: { notIn: [...SEED_EMAILS] } },
    });
    const role = realUserCount === 0 ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? email.split('@')[0],
        role,
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
