import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import {
  saveOfflineUser,
  verifyOfflinePassword,
  initOfflineDb,
  updateOfflineModeStatus,
} from './offline-db';
import { verifyOfflineLicense } from './offline-mode';

// 앱 시작 시 오프라인 DB 초기화
try {
  initOfflineDb();
  console.log('[Auth] Offline DB initialized successfully');
} catch (err) {
  console.warn('[Auth] Offline DB initialization failed (non-critical):', err);
}

// ✅ Desktop 모드 감지
const IS_DESKTOP_MODE = process.env.PTZ_DESKTOP_MODE === 'true';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn('[Auth] Missing email or password');
          return null;
        }

        const DB_AUTH_TIMEOUT_MS = 3_000;
        
        // ==========================================
        // 1단계: 온라인 인증 시도 (모두 동일)
        // ==========================================
        try {
          console.log(`[Auth] 온라인 로그인 시도 (${IS_DESKTOP_MODE ? 'Desktop' : 'Admin'})`, credentials.email);
          const user = await Promise.race([
            prisma.user.findUnique({ 
              where: { email: credentials.email },
              select: {
                id: true,
                email: true,
                name: true,
                password: true,
                role: true,
                organization: true,
              }
            }),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), DB_AUTH_TIMEOUT_MS)
            ),
          ]);

          if (user && user.password) {
            const isValid = await bcrypt.compare(credentials.password, user.password);
            if (isValid) {
              console.log(`[Auth] ✅ 온라인 로그인 성공 (${IS_DESKTOP_MODE ? 'Desktop' : 'Admin'}):`, credentials.email);
              
              // 오프라인 DB에 동기화
              try {
                await saveOfflineUser({
                  email: user.email,
                  name: user.name || 'User',
                  organization: user.organization || undefined,
                  passwordHash: user.password,
                  role: (user.role as 'user' | 'admin') || 'user',
                  lastOnlineLoginAt: new Date().toISOString(),
                  lastSyncAt: new Date().toISOString(),
                  platform: process.platform,
                  appVersion: process.env.npm_package_version,
                });
                console.log('[Auth] ✅ 오프라인 DB 동기화:', credentials.email);
              } catch (err) {
                console.warn('[Auth] ⚠️  오프라인 DB 동기화 실패:', err);
              }
              
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            }
          }
        } catch (error) {
          console.log(`[Auth] 온라인 DB 연결 불가 (${IS_DESKTOP_MODE ? 'Desktop' : 'Admin'}):`, error instanceof Error ? error.message : String(error));
        }

        // ==========================================
        // 2단계: 오프라인 폴백 (Desktop만)
        // ==========================================
        if (IS_DESKTOP_MODE) {
          console.log('[Auth] Desktop 오프라인 폴백 시도:', credentials.email);
          try {
            // ✅ Desktop: 라이선스 검증 필수
            const licenseStatus = await verifyOfflineLicense();
            if (!licenseStatus.valid) {
              console.warn('[Auth] ❌ Desktop 오프라인: 라이선스 없음 또<span class="cursor">█</span>
                